import { BrowserWindow, app, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  IPC_CHANNELS,
  MAX_SEND_LENGTH,
  MAX_TERMINAL_WRITE,
  isApiKeyProviderId,
  type IpcArgs,
  type IpcChannel,
  type IpcResult
} from '../../shared/ipc'
import type { ActivationResult, Voyage } from '../../shared/types/app'
import { checkAllClis } from './core/cli-check'
import { CrewPackError, loadCrewIndex, loadCrewPack } from './core/crew-loader'
import { agentManager, resumeVoyage, specFor } from './agents/service'
import {
  addWorktree,
  assertAgentId,
  ensureRepoWithCommit,
  excludeGrandFleetDir,
  listActiveAgents,
  removeWorktree,
  repoState,
  worktreePath
} from './core/worktrees'
import { assetsRoot } from './paths'
import { openInEditor } from './ide'
import {
  apiKeyStatuses,
  clearApiKey,
  encryptionAvailable,
  loadPreferences,
  savePreferences,
  setApiKey
} from './settings-store'
import {
  forgetVoyage,
  getVoyage,
  listActivity,
  listVoyages,
  logActivity,
  newVoyageFolder,
  touchVoyage,
  upsertVoyage
} from './voyages'

type Handler<C extends IpcChannel> = (args: IpcArgs<C>, event: IpcMainInvokeEvent) => IpcResult<C> | Promise<IpcResult<C>>

function requireString(value: unknown, what: string, max = 500): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`Invalid ${what}.`)
  return value
}

function crewPackFor(crewId: string) {
  return loadCrewPack(assetsRoot(), crewId)
}

function windowFor(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

function requireAgentId(value: unknown): string {
  const id = requireString(value, 'agent id', 41)
  assertAgentId(id)
  return id
}

async function openVoyageAt(crewId: string, dir: string): Promise<Voyage> {
  await ensureRepoWithCommit(dir)
  await excludeGrandFleetDir(dir)
  const voyage = upsertVoyage(crewId, dir)
  savePreferences({ activeVoyageId: voyage.id })
  logActivity({ crewId, voyageId: voyage.id, kind: 'voyage', message: `Set sail on "${voyage.name}".` })
  await resumeVoyage(voyage, crewPackFor(crewId))
  return voyage
}

/** `git worktree remove` can fail briefly on Windows while the killed process releases its folder. */
async function removeWorktreeWithRetry(repo: string, agentId: string) {
  try {
    return await removeWorktree(repo, agentId)
  } catch {
    await new Promise((r) => setTimeout(r, 800))
    try {
      return await removeWorktree(repo, agentId)
    } catch (err) {
      return { removed: false, reason: `Could not remove the worktree yet: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
}

export function registerIpc(getMainWindow: () => BrowserWindow | null): void {
  const handlers: { [C in IpcChannel]: Handler<C> } = {
    'app:getVersion': () => app.getVersion(),

    'window:toggleFullscreen': (_a, event) => {
      const win = windowFor(event)
      if (!win) return false
      win.setFullScreen(!win.isFullScreen())
      return win.isFullScreen()
    },

    'settings:get': () => loadPreferences(),
    'settings:set': async (patch) => {
      const prefs = savePreferences(patch)
      // Leaving every voyage (e.g. switching crews) parks the running sessions; they resume on return.
      if (patch && 'activeVoyageId' in patch && patch.activeVoyageId === null) await agentManager().attachVoyage(null)
      return prefs
    },
    'settings:pickVoyagesRoot': async (_a, event) => {
      const win = windowFor(event)
      const opts = {
        title: 'Choose the folder where new voyages are created',
        properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
      }
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (res.canceled || res.filePaths.length === 0) return loadPreferences()
      return savePreferences({ voyagesRoot: res.filePaths[0] })
    },
    'settings:apiKeyStatus': () => apiKeyStatuses(),
    'settings:setApiKey': ({ provider, key }) => {
      if (!isApiKeyProviderId(provider)) throw new Error('Unknown provider.')
      setApiKey(provider, requireString(key, 'key', 500))
      return apiKeyStatuses()
    },
    'settings:clearApiKey': ({ provider }) => {
      if (!isApiKeyProviderId(provider)) throw new Error('Unknown provider.')
      clearApiKey(provider)
      return apiKeyStatuses()
    },
    'settings:encryptionAvailable': () => encryptionAvailable(),

    'providers:checkCli': () => checkAllClis(),

    'crews:list': () => loadCrewIndex(assetsRoot()),
    'crews:load': ({ crewId }) => crewPackFor(requireString(crewId, 'crew id', 41)),

    'voyages:list': ({ crewId }) => listVoyages(requireString(crewId, 'crew id', 41)),
    'voyages:pickAndOpen': async ({ crewId }, event) => {
      requireString(crewId, 'crew id', 41)
      const win = windowFor(event)
      const opts = { title: 'Choose a project for this voyage', properties: ['openDirectory'] as Array<'openDirectory'> }
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (res.canceled || res.filePaths.length === 0) return null
      const dir = res.filePaths[0]
      const state = await repoState(dir)
      if (state === 'none') {
        const msgOpts = {
          type: 'question' as const,
          buttons: ['Initialize git here', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          message: 'This folder is not a git repository.',
          detail: 'Each crew member works in their own git worktree, so Grand Fleet needs a repository. Initialize one in this folder?'
        }
        const choice = win ? await dialog.showMessageBox(win, msgOpts) : await dialog.showMessageBox(msgOpts)
        if (choice.response !== 0) return null
      }
      return openVoyageAt(crewId, dir)
    },
    'voyages:create': async ({ crewId, name }) => {
      requireString(crewId, 'crew id', 41)
      const dir = newVoyageFolder(loadPreferences().voyagesRoot, requireString(name, 'name', 64))
      return openVoyageAt(crewId, dir)
    },
    'voyages:open': async ({ id }) => {
      const voyage = touchVoyage(requireString(id, 'voyage id', 80))
      await ensureRepoWithCommit(voyage.path)
      await excludeGrandFleetDir(voyage.path)
      savePreferences({ activeVoyageId: voyage.id })
      await resumeVoyage(voyage, crewPackFor(voyage.crewId))
      return voyage
    },
    'voyages:forget': async ({ id }, _event) => {
      const voyage = getVoyage(requireString(id, 'voyage id', 80))
      forgetVoyage(voyage.id)
      if (loadPreferences().activeVoyageId === voyage.id) {
        savePreferences({ activeVoyageId: null })
        await agentManager().attachVoyage(null)
      }
      return listVoyages(voyage.crewId)
    },

    'agents:listActive': async ({ voyageId }) => {
      const voyage = getVoyage(requireString(voyageId, 'voyage id', 80))
      if (!existsSync(voyage.path)) return []
      return listActiveAgents(voyage.path)
    },
    'agents:setActive': async ({ voyageId, agentId, active }): Promise<ActivationResult> => {
      const voyage = getVoyage(requireString(voyageId, 'voyage id', 80))
      const pack = crewPackFor(voyage.crewId)
      const character = pack.characters.find((c) => c.id === agentId)
      if (!character) throw new Error('That crew member is not part of this voyage.')
      if (active) {
        const wt = await addWorktree(voyage.path, agentId)
        logActivity({ crewId: voyage.crewId, voyageId, agentId, kind: 'agent', message: `${character.displayName} reported for duty.` })
        await agentManager().start(voyage, specFor(voyage, pack, agentId))
        return { agentId, active: true, worktreePath: wt, warning: null }
      }
      // The session must be gone before its folder can be removed.
      await agentManager().stop(agentId)
      const res = await removeWorktreeWithRetry(voyage.path, agentId)
      logActivity({
        crewId: voyage.crewId,
        voyageId,
        agentId,
        kind: 'agent',
        message: res.removed ? `${character.displayName} went off duty.` : `${character.displayName} stayed on duty: ${res.reason}`
      })
      return {
        agentId,
        active: !res.removed,
        worktreePath: res.removed ? null : worktreePath(voyage.path, agentId),
        warning: res.reason
      }
    },
    'agents:openInIde': async ({ voyageId, agentId }) => {
      const voyage = getVoyage(requireString(voyageId, 'voyage id', 80))
      let dir = voyage.path
      if (agentId) {
        const pack = crewPackFor(voyage.crewId)
        if (!pack.characters.some((c) => c.id === agentId)) throw new Error('That crew member is not part of this voyage.')
        const wt = worktreePath(voyage.path, agentId)
        if (!existsSync(wt)) throw new Error('That crew member is off duty and has no working folder yet.')
        dir = wt
      }
      if (!existsSync(dir)) throw new Error(`Folder not found: ${dir}`)
      openInEditor(path.resolve(dir), loadPreferences().editor)
      return { opened: dir }
    },

    'agents:snapshot': () => agentManager().snapshot(),
    'agents:terminalBuffer': ({ agentId }) => agentManager().terminalBuffer(requireAgentId(agentId)),
    'agents:write': ({ agentId, data }) => {
      if (typeof data !== 'string' || data.length > MAX_TERMINAL_WRITE) throw new Error('Invalid terminal input.')
      agentManager().write(requireAgentId(agentId), data)
    },
    'agents:resize': ({ agentId, cols, rows }) => {
      if (!Number.isFinite(cols) || !Number.isFinite(rows)) throw new Error('Invalid terminal size.')
      agentManager().resize(requireAgentId(agentId), cols, rows)
    },
    'agents:send': ({ agentId, message }) => {
      agentManager().send(requireAgentId(agentId), requireString(message, 'message', MAX_SEND_LENGTH))
    },
    'agents:decide': ({ agentId, requestId, decision }) => {
      if (decision !== 'allow' && decision !== 'deny') throw new Error('Invalid decision.')
      agentManager().decide(requireAgentId(agentId), requireString(requestId, 'request id', 80), decision)
    },
    'agents:restart': async ({ voyageId, agentId }) => {
      const voyage = getVoyage(requireString(voyageId, 'voyage id', 80))
      const id = requireAgentId(agentId)
      if (!existsSync(worktreePath(voyage.path, id))) throw new Error('That crew member is off duty.')
      await agentManager().start(voyage, specFor(voyage, crewPackFor(voyage.crewId), id))
    },

    'activity:list': ({ crewId, limit }) => listActivity(requireString(crewId, 'crew id', 41), limit)
  }

  const trusted = (event: IpcMainInvokeEvent): boolean => {
    const win = getMainWindow()
    return !!win && event.sender === win.webContents
  }

  for (const channel of IPC_CHANNELS) {
    const handler = handlers[channel] as Handler<IpcChannel>
    ipcMain.handle(channel, async (event, args) => {
      if (!trusted(event)) throw new Error('Untrusted IPC sender.')
      try {
        return await handler(args as never, event)
      } catch (err) {
        if (err instanceof CrewPackError) throw new Error(err.message)
        throw err
      }
    })
  }
}
