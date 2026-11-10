/** Runtime agent types shared by main and renderer. */
import type { AgentStatus } from './app'
import type { PolicyCategory } from './policy'

export type LiveStatus = Exclude<AgentStatus, 'off_duty'>

export interface UsageInfo {
  /** 0-100, null until the provider reports it. */
  contextPercent: number | null
  contextWindowSize: number | null
  costUsd: number
  inputTokens: number
  outputTokens: number
  model: string | null
}

export const EMPTY_USAGE: UsageInfo = {
  contextPercent: null,
  contextWindowSize: null,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  model: null
}

/** A tool-permission request waiting in the Den Den Mushi queue. */
export interface PermissionRequestInfo {
  id: string
  agentId: string
  voyageId: string
  tool: string
  /** One-line description, e.g. "Run: pnpm install". */
  summary: string
  /** Full command / path / URL for the details view. */
  detail: string
  category: PolicyCategory
  /** Why this was not auto-approved. */
  reason: string
  requestedAt: string
}

export type PermissionOutcome = 'allow' | 'deny' | 'terminal' | 'stopped'
export type PermissionDecidedBy = 'user' | 'policy' | 'terminal' | 'system'

export type LogKind = 'status' | 'tool' | 'permission' | 'task' | 'error' | 'system'

export interface LogEntry {
  id: number
  at: string
  kind: LogKind
  text: string
}

/** What the renderer needs to rebuild one agent's live state after a reload. */
export interface AgentSnapshot {
  agentId: string
  running: boolean
  status: LiveStatus
  statusText: string
  startedAt: string | null
  error: string | null
  usage: UsageInfo
  pending: PermissionRequestInfo[]
  log: LogEntry[]
}

export type AgentEvent =
  | { type: 'status'; agentId: string; status: LiveStatus; statusText: string }
  | { type: 'running'; agentId: string; running: boolean; startedAt: string | null; error: string | null }
  | { type: 'log'; agentId: string; entry: LogEntry }
  | { type: 'usage'; agentId: string; usage: UsageInfo }
  | { type: 'permissionRequest'; request: PermissionRequestInfo }
  | {
      type: 'permissionResolved'
      agentId: string
      requestId: string
      outcome: PermissionOutcome
      by: PermissionDecidedBy
    }
  | { type: 'activity' }

/** A chunk of terminal output. `end` is the cumulative character offset after this chunk. */
export interface AgentOutputChunk {
  agentId: string
  data: string
  end: number
}

export interface TerminalBuffer {
  data: string
  end: number
}

export const MAX_TERMINAL_WRITE = 64 * 1024
export const MAX_SEND_LENGTH = 100_000
