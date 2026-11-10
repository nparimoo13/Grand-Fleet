import type { LiveStatus, UsageInfo } from '../../../shared/types/agents'
import type { ToolRequest } from '../../../shared/types/policy'

/**
 * Provider adapter contract. Every provider (Claude Code CLI now; Codex CLI and
 * the API providers in Phase 8) emits the same normalized events, so the rest of
 * the app never knows which backend an agent runs on.
 */

export interface AgentConfig {
  agentId: string
  displayName: string
  /** The agent's own git worktree. */
  cwd: string
  /** 'default' lets the provider pick. */
  model: string
  systemPrompt: string
  /** Provider-side session id to resume, when one exists. */
  resumeSessionId: string | null
  cols: number
  rows: number
}

export interface PermissionRequestEvent {
  /** Provider-unique id; pass back to approve(). */
  id: string
  tool: string
  summary: string
  detail: string
  /** Normalized requests for the policy engine. null = unrecognized, always ask. */
  requests: ToolRequest[] | null
}

export interface ProviderSessionEvents {
  output: { data: string }
  status: { status: LiveStatus; text: string }
  toolCall: { phase: 'start' | 'end'; tool: string; summary: string; ok?: boolean }
  permissionRequest: PermissionRequestEvent
  /** The provider stopped waiting (user answered in the terminal, timeout, ...). */
  permissionCancelled: { id: string; reason: 'terminal' | 'timeout' }
  usage: Partial<UsageInfo>
  /** One full turn finished. */
  turn: { message: string | null }
  /** Provider-side session identity, for resuming later. */
  session: { externalId: string; confirmed: boolean }
  exit: { code: number | null; signal: number | null; requested: boolean }
}

export type ProviderSessionEventName = keyof ProviderSessionEvents

export interface AgentSession {
  readonly pid: number | null
  /** Send a message as if the user typed it and pressed Enter. */
  send(message: string, attachments?: string[]): void
  /** Raw keystrokes from an interactive terminal. */
  write(data: string): void
  resize(cols: number, rows: number): void
  approve(requestId: string, decision: 'allow' | 'deny', message?: string): void
  stop(): Promise<void>
  on<E extends ProviderSessionEventName>(event: E, cb: (payload: ProviderSessionEvents[E]) => void): () => void
}

export interface AgentProvider {
  readonly id: string
  start(config: AgentConfig): Promise<AgentSession>
}

/** Minimal typed emitter shared by provider implementations. */
export class SessionEmitter {
  private listeners = new Map<string, Set<(payload: never) => void>>()

  on<E extends ProviderSessionEventName>(event: E, cb: (payload: ProviderSessionEvents[E]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(cb as (payload: never) => void)
    return () => {
      set?.delete(cb as (payload: never) => void)
    }
  }

  emit<E extends ProviderSessionEventName>(event: E, payload: ProviderSessionEvents[E]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const cb of [...set]) {
      try {
        ;(cb as (p: ProviderSessionEvents[E]) => void)(payload)
      } catch {
        // a listener must never break the session
      }
    }
  }
}
