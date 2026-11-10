import type { AgentStatus } from '@shared/ipc'

export interface AgentRuntime {
  status: AgentStatus
  statusLine: string
  /** null until a provider reports usage. */
  contextPercent: number | null
  /** Tokens currently in the context window, null until reported. */
  contextTokens: number | null
  costUsd: number | null
  startedAt: number | null
  /** A provider session is actually running (false while starting, failed or off duty). */
  running: boolean
  /** Why the session could not start or ended, if it did. */
  error: string | null
}

export const OFF_DUTY_RUNTIME: AgentRuntime = {
  status: 'off_duty',
  statusLine: 'Off duty.',
  contextPercent: null,
  contextTokens: null,
  costUsd: null,
  startedAt: null,
  running: false,
  error: null
}

export interface Bounty {
  id: string
  title: string
  assigneeId: string | null
  column: 'todo' | 'in_progress' | 'done'
}

/** A permission request in the Den Den Mushi queue (real or demo). */
export interface DenDenRequest {
  id: string
  agentId: string
  summary: string
  detail: string
  at: number
  /** Real requests only: why it was not auto-approved. */
  reason?: string
  categoryLabel?: string
  tool?: string
}

export interface ActivityItem {
  id: string
  at: string
  message: string
}

export { effectiveCharacter, effectiveCharacters, type EffectiveCharacter } from '@shared/crew-merge'
