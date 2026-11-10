/** Typed IPC contract between main and renderer. */
import type {
  ActivationResult,
  ActivityRecord,
  AppPreferences,
  Voyage
} from './types/app'
import type { AgentEvent, AgentOutputChunk, AgentSnapshot, TerminalBuffer } from './types/agents'
import type { CrewIndexEntry, CrewPack } from './types/crew'
import type { ApiKeyProviderId, ApiKeyStatus, CliCheckResult } from './types/providers'

export type * from './types/agents'
export type * from './types/art'
export type * from './types/app'
export type * from './types/crew'
export type * from './types/policy'
export type * from './types/providers'
export { DEFAULT_PREFERENCES } from './types/app'
export { EMPTY_USAGE, MAX_SEND_LENGTH, MAX_TERMINAL_WRITE } from './types/agents'
export {
  CATEGORY_LABELS,
  DEFAULT_POLICY,
  POLICY_CATEGORY_ORDER
} from './types/policy'
export {
  API_KEY_PROVIDER_IDS,
  CLI_PROVIDER_IDS,
  PROVIDERS,
  PROVIDER_IDS,
  isApiKeyProviderId,
  isProviderId
} from './types/providers'

export interface IpcInvokeMap {
  'app:getVersion': { args: void; result: string }
  'window:toggleFullscreen': { args: void; result: boolean }

  'settings:get': { args: void; result: AppPreferences }
  'settings:set': { args: Partial<AppPreferences>; result: AppPreferences }
  'settings:pickVoyagesRoot': { args: void; result: AppPreferences }
  'settings:apiKeyStatus': { args: void; result: ApiKeyStatus[] }
  'settings:setApiKey': {
    args: { provider: ApiKeyProviderId; key: string }
    result: ApiKeyStatus[]
  }
  'settings:clearApiKey': { args: { provider: ApiKeyProviderId }; result: ApiKeyStatus[] }
  'settings:encryptionAvailable': { args: void; result: boolean }

  'providers:checkCli': { args: void; result: CliCheckResult[] }

  'crews:list': { args: void; result: CrewIndexEntry[] }
  'crews:load': { args: { crewId: string }; result: CrewPack }

  'voyages:list': { args: { crewId: string }; result: Voyage[] }
  'voyages:pickAndOpen': { args: { crewId: string }; result: Voyage | null }
  'voyages:create': { args: { crewId: string; name: string }; result: Voyage }
  'voyages:open': { args: { id: string }; result: Voyage }
  'voyages:forget': { args: { id: string }; result: Voyage[] }

  'agents:listActive': { args: { voyageId: string }; result: string[] }
  'agents:setActive': {
    args: { voyageId: string; agentId: string; active: boolean }
    result: ActivationResult
  }
  'agents:openInIde': { args: { voyageId: string; agentId: string | null }; result: { opened: string } }
  'agents:snapshot': { args: void; result: AgentSnapshot[] }
  'agents:terminalBuffer': { args: { agentId: string }; result: TerminalBuffer }
  'agents:write': { args: { agentId: string; data: string }; result: void }
  'agents:resize': { args: { agentId: string; cols: number; rows: number }; result: void }
  'agents:send': { args: { agentId: string; message: string }; result: void }
  'agents:decide': { args: { agentId: string; requestId: string; decision: 'allow' | 'deny' }; result: void }
  'agents:restart': { args: { voyageId: string; agentId: string }; result: void }

  'activity:list': { args: { crewId: string; limit?: number }; result: ActivityRecord[] }
}

export type IpcChannel = keyof IpcInvokeMap
export type IpcArgs<C extends IpcChannel> = IpcInvokeMap[C]['args']
export type IpcResult<C extends IpcChannel> = IpcInvokeMap[C]['result']

/** Channels the renderer is allowed to call. Preload enforces this list. */
export const IPC_CHANNELS: readonly IpcChannel[] = [
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
]

/** Events pushed from main to the renderer. */
export interface IpcEventMap {
  'agent:output': AgentOutputChunk
  'agent:event': AgentEvent
}

export type IpcEventChannel = keyof IpcEventMap

/** Event channels the renderer may subscribe to. Preload enforces this list. */
export const IPC_EVENT_CHANNELS: readonly IpcEventChannel[] = ['agent:output', 'agent:event']
