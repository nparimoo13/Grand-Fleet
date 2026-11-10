import { app, type BrowserWindow } from 'electron'
import path from 'node:path'
import { effectiveCharacter } from '../../../shared/crew-merge'
import type { Voyage } from '../../../shared/types/app'
import type { CrewPack } from '../../../shared/types/crew'
import { listActiveAgents, worktreePath } from '../core/worktrees'
import { loadPreferences } from '../settings-store'
import { logActivity } from '../voyages'
import { ClaudeCodeProvider } from './claude-code'
import { HookServer } from './hook-server'
import { AgentManager, type AgentStartSpec } from './manager'
import { sqliteSessionStore } from './session-store'

let manager: AgentManager | null = null
let hookServer: HookServer | null = null

/** Start the hook server and the manager. Call once, after the window exists. */
export async function initAgents(getWindow: () => BrowserWindow | null): Promise<AgentManager> {
  if (manager) return manager
  const server = new HookServer()
  await server.start()
  hookServer = server

  const claude = new ClaudeCodeProvider({
    hookServer: server,
    dataDir: path.join(app.getPath('userData'), 'agents')
  })

  const send = (channel: 'agent:event' | 'agent:output', payload: unknown): void => {
    const win = getWindow()
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, payload)
  }

  manager = new AgentManager({
    providers: (id) => (id === claude.id ? claude : null),
    getPrefs: loadPreferences,
    store: sqliteSessionStore,
    logActivity: (a) => logActivity(a),
    emit: (event) => send('agent:event', event),
    emitOutput: (chunk) => send('agent:output', chunk)
  })
  return manager
}

export function agentManager(): AgentManager {
  if (!manager) throw new Error('The agent engine is not running.')
  return manager
}

export async function shutdownAgents(): Promise<void> {
  const m = manager
  manager = null
  await m?.dispose()
  await hookServer?.stop()
  hookServer = null
}

/** Build the start spec for one crew member from the crew pack and the user's overrides. */
export function specFor(voyage: Voyage, pack: CrewPack, agentId: string): AgentStartSpec {
  const def = pack.characters.find((c) => c.id === agentId)
  if (!def) throw new Error('That crew member is not part of this voyage.')
  const override = loadPreferences().characterOverrides[pack.id]?.[agentId]
  const eff = effectiveCharacter(def, override)
  return {
    agentId,
    displayName: eff.displayName,
    worktree: worktreePath(voyage.path, agentId),
    providerId: eff.provider,
    model: eff.model,
    systemPrompt: eff.systemPrompt
  }
}

/** Attach the voyage and bring every on-duty crew member's session up, a few hundred ms apart. */
export async function resumeVoyage(voyage: Voyage, pack: CrewPack): Promise<void> {
  const m = agentManager()
  await m.attachVoyage(voyage)
  const ids = await listActiveAgents(voyage.path)
  void (async () => {
    for (const id of ids) {
      if (m.has(id)) continue
      try {
        await m.start(voyage, specFor(voyage, pack, id))
      } catch {
        // start() records failures itself; spec errors mean the character left the pack
      }
      await new Promise((r) => setTimeout(r, 300))
    }
  })()
}
