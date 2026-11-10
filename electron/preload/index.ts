import { contextBridge, ipcRenderer } from 'electron'
import type { IpcArgs, IpcChannel, IpcEventChannel, IpcEventMap, IpcResult } from '../../shared/ipc'

// Inlined (not imported) because a sandboxed preload cannot require local modules.
// Keep in sync with IPC_CHANNELS / IPC_EVENT_CHANNELS in shared/ipc.ts; checked by the unit test.
const ALLOWED: ReadonlySet<string> = new Set([
  'app:getVersion',
  'window:toggleFullscreen',
  'settings:get',
  'settings:set',
  'settings:pickVoyagesRoot',
  'settings:apiKeyStatus',
  'settings:setApiKey',
  'settings:clearApiKey',
  'settings:encryptionAvailable',
  'providers:checkCli',
  'crews:list',
  'crews:load',
  'voyages:list',
  'voyages:pickAndOpen',
  'voyages:create',
  'voyages:open',
  'voyages:forget',
  'agents:listActive',
  'agents:setActive',
  'agents:openInIde',
  'agents:snapshot',
  'agents:terminalBuffer',
  'agents:write',
  'agents:resize',
  'agents:send',
  'agents:decide',
  'agents:restart',
  'activity:list'
])

const ALLOWED_EVENTS: ReadonlySet<string> = new Set(['agent:output', 'agent:event'])

const grandFleet = {
  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcArgs<C> extends void ? [] : [IpcArgs<C>]
  ): Promise<IpcResult<C>> {
    if (!ALLOWED.has(channel)) return Promise.reject(new Error(`Blocked IPC channel: ${channel}`))
    return ipcRenderer.invoke(channel, args[0])
  },

  /** Subscribe to a main-to-renderer event. Returns an unsubscribe function. The IPC event object is never exposed. */
  on<E extends IpcEventChannel>(channel: E, callback: (payload: IpcEventMap[E]) => void): () => void {
    if (!ALLOWED_EVENTS.has(channel)) throw new Error(`Blocked IPC event channel: ${channel}`)
    const listener = (_event: unknown, payload: IpcEventMap[E]): void => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

export type GrandFleetApi = typeof grandFleet

contextBridge.exposeInMainWorld('grandFleet', grandFleet)
