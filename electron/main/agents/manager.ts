import { randomUUID } from 'node:crypto'
import {
  EMPTY_USAGE,
  MAX_SEND_LENGTH,
  type AgentEvent,
  type AgentOutputChunk,
  type AgentSnapshot,
  type LiveStatus,
  type LogEntry,
  type LogKind,
  type PermissionDecidedBy,
  type PermissionOutcome,
  type PermissionRequestInfo,
  type TerminalBuffer,
  type UsageInfo
} from '../../../shared/types/agents'
import type { AppPreferences } from '../../../shared/types/app'
import type { PolicyVerdict, ToolRequest } from '../../../shared/types/policy'
import { evaluatePolicy } from '../core/policy'
import type { AgentConfig, AgentProvider, AgentSession, PermissionRequestEvent } from './provider'

export interface VoyageRef {
  id: string
  crewId: string
  path: string
}

export interface AgentStartSpec {
  agentId: string
  displayName: string
  worktree: string
  providerId: string
  model: string
  systemPrompt: string
}

export interface SessionStore {
  begin(row: {
    id: string
    crewId: string
    voyageId: string
    agentId: string
    provider: string
    model: string
    externalId: string | null
  }): void
  setExternal(id: string, externalId: string, confirmed: boolean): void
  /** External id of the most recent confirmed session for this agent in this voyage. */
  lastResumable(voyageId: string, agentId: string): string | null
  updateCost(id: string, costUsd: number): void
  end(id: string, status: string): void
}

export interface ActivityInput {
  crewId: string
  voyageId: string
  agentId: string
  kind: string
  message: string
}

export interface ManagerDeps {
  providers: (id: string) => AgentProvider | null
  getPrefs: () => AppPreferences
  store: SessionStore
  logActivity: (a: ActivityInput) => void
  emit: (event: AgentEvent) => void
  emitOutput: (chunk: AgentOutputChunk) => void
  now?: () => Date
}

const MAX_LOG = 500
const MAX_BUFFER = 400_000
const FLUSH_MS = 16
const FLUSH_MAX = 64 * 1024
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32

interface Runtime {
  agentId: string
  voyage: VoyageRef
  spec: AgentStartSpec
  session: AgentSession | null
  rowId: string | null
  starting: boolean
  startedAt: string | null
  status: LiveStatus
  statusText: string
  error: string | null
  usage: UsageInfo
  pending: Map<string, PermissionRequestInfo>
  log: LogEntry[]
  buffer: string
  total: number
  outBuf: string
  flushTimer: ReturnType<typeof setTimeout> | null
  /** Bumped on every (re)start so late events from a previous session are ignored. */
  generation: number
  stopRequested: boolean
  cols: number
  rows: number
}

export class AgentManager {
  private runtimes = new Map<string, Runtime>()
  private voyage: VoyageRef | null = null
  private logSeq = 0
  private disposed = false

  constructor(private readonly deps: ManagerDeps) {}

  private nowIso(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }

  // ---- lifecycle ----

  /** Switch the active voyage. Sessions of any previous voyage are stopped. */
  async attachVoyage(voyage: VoyageRef | null): Promise<void> {
    if (this.voyage?.id === voyage?.id) return
    await this.stopAll()
    this.voyage = voyage
  }

  has(agentId: string): boolean {
    return this.runtimes.has(agentId)
  }

  /** Start (or restart) one agent. Never throws: failures become an error state the UI can retry. */
  async start(voyage: VoyageRef, spec: AgentStartSpec): Promise<void> {
    if (this.disposed) return
    if (this.voyage?.id !== voyage.id) await this.attachVoyage(voyage)
    const existing = this.runtimes.get(spec.agentId)
    if (existing?.session) await this.stop(spec.agentId)
    if (existing?.starting) return

    const rt: Runtime = existing ?? this.newRuntime(voyage, spec)
    rt.voyage = voyage
    rt.spec = spec
    rt.generation++
    rt.stopRequested = false
    rt.starting = true
    rt.error = null
    rt.pending.clear()
    this.runtimes.set(spec.agentId, rt)
    const gen = rt.generation
    this.setStatus(rt, 'idle', 'Starting…')

    const provider = this.deps.providers(spec.providerId)
    if (!provider) {
      this.fail(rt, `The "${spec.providerId}" provider is not wired up yet. Only Claude Code CLI is available in this build.`)
      return
    }

    const config: AgentConfig = {
      agentId: spec.agentId,
      displayName: spec.displayName,
      cwd: spec.worktree,
      model: spec.model,
      systemPrompt: spec.systemPrompt,
      resumeSessionId: this.deps.store.lastResumable(voyage.id, spec.agentId),
      cols: rt.cols,
      rows: rt.rows
    }
    try {
      const session = await provider.start(config)
      if (rt.generation !== gen || this.disposed) {
        await session.stop()
        return
      }
      rt.session = session
      rt.starting = false
      rt.startedAt = this.nowIso()
      rt.rowId = randomUUID()
      this.deps.store.begin({
        id: rt.rowId,
        crewId: voyage.crewId,
        voyageId: voyage.id,
        agentId: spec.agentId,
        provider: spec.providerId,
        model: spec.model,
        externalId: config.resumeSessionId
      })
      this.wire(rt, session, gen)
      this.deps.emit({ type: 'running', agentId: spec.agentId, running: true, startedAt: rt.startedAt, error: null })
      this.addLog(rt, 'system', `${spec.displayName} reported to ${spec.providerId}.`)
    } catch (err) {
      if (rt.generation === gen) this.fail(rt, err instanceof Error ? err.message : String(err))
    }
  }

  /** Stop one agent's session and forget its runtime (used when going off duty). */
  async stop(agentId: string): Promise<void> {
    const rt = this.runtimes.get(agentId)
    if (!rt) return
    rt.generation++
    rt.stopRequested = true
    this.cancelPending(rt, 'stopped', 'system')
    const session = rt.session
    rt.session = null
    rt.starting = false
    if (session) await session.stop().catch(() => undefined)
    this.flush(rt)
    if (rt.rowId) this.deps.store.end(rt.rowId, 'stopped')
    this.runtimes.delete(agentId)
    this.deps.emit({ type: 'running', agentId, running: false, startedAt: null, error: null })
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.runtimes.keys()].map((id) => this.stop(id)))
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await this.stopAll()
  }

  private newRuntime(voyage: VoyageRef, spec: AgentStartSpec): Runtime {
    return {
      agentId: spec.agentId,
      voyage,
      spec,
      session: null,
      rowId: null,
      starting: false,
      startedAt: null,
      status: 'idle',
      statusText: 'Standing by.',
      error: null,
      usage: { ...EMPTY_USAGE },
      pending: new Map(),
      log: [],
      buffer: '',
      total: 0,
      outBuf: '',
      flushTimer: null,
      generation: 0,
      stopRequested: false,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS
    }
  }

  private fail(rt: Runtime, message: string): void {
    rt.starting = false
    rt.session = null
    rt.error = message
    this.setStatus(rt, 'error', message)
    this.addLog(rt, 'error', message)
    this.appendOutput(rt, `\r\n\x1b[31m[Grand Fleet] ${message}\x1b[0m\r\n`)
    this.deps.emit({ type: 'running', agentId: rt.agentId, running: false, startedAt: null, error: message })
    this.activity(rt, 'error', `${rt.spec.displayName} could not start: ${message}`)
  }

  // ---- provider events ----

  private wire(rt: Runtime, session: AgentSession, gen: number): void {
    const live = (): boolean => rt.generation === gen
    session.on('output', ({ data }) => live() && this.appendOutput(rt, data))
    session.on('status', ({ status, text }) => live() && this.setStatus(rt, status, text))
    session.on('toolCall', (t) => {
      if (!live()) return
      if (t.phase === 'start') this.addLog(rt, 'tool', t.summary)
      else if (t.ok === false) this.addLog(rt, 'error', `Tool failed: ${t.summary}`)
    })
    session.on('permissionRequest', (r) => live() && this.onPermission(rt, session, r))
    session.on('permissionCancelled', ({ id }) => {
      if (!live()) return
      if (rt.pending.has(id)) this.resolvePending(rt, id, 'terminal', 'terminal')
    })
    session.on('usage', (u) => {
      if (!live()) return
      rt.usage = {
        ...rt.usage,
        ...Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined))
      }
      this.deps.emit({ type: 'usage', agentId: rt.agentId, usage: rt.usage })
      if (rt.rowId && typeof u.costUsd === 'number') this.deps.store.updateCost(rt.rowId, u.costUsd)
    })
    session.on('turn', ({ message }) => {
      if (!live()) return
      const snippet = message ? message.replace(/\s+/g, ' ').trim().slice(0, 140) : ''
      this.addLog(rt, 'task', snippet ? `Finished a turn: ${snippet}` : 'Finished a turn.')
      this.activity(rt, 'task', `${rt.spec.displayName} finished a turn${snippet ? `: ${snippet}` : '.'}`)
    })
    session.on('session', ({ externalId, confirmed }) => {
      if (!live() || !rt.rowId) return
      this.deps.store.setExternal(rt.rowId, externalId, confirmed)
    })
    session.on('exit', ({ code, requested }) => {
      if (!live() || requested) return
      rt.session = null
      this.cancelPending(rt, 'stopped', 'system')
      const msg = `The session ended unexpectedly (exit code ${code ?? 'unknown'}).`
      rt.error = msg
      this.setStatus(rt, 'error', msg)
      this.addLog(rt, 'error', msg)
      this.appendOutput(rt, `\r\n\x1b[31m[Grand Fleet] ${msg}\x1b[0m\r\n`)
      if (rt.rowId) this.deps.store.end(rt.rowId, 'exited')
      this.deps.emit({ type: 'running', agentId: rt.agentId, running: false, startedAt: null, error: msg })
      this.activity(rt, 'error', `${rt.spec.displayName}'s session ended unexpectedly.`)
    })
  }

  private verdictFor(rt: Runtime, requests: ToolRequest[] | null): PolicyVerdict {
    if (!requests || requests.length === 0) {
      return { decision: 'ask', category: 'unlisted_shell', reason: 'This tool is not covered by the auto-approval policy' }
    }
    const prefs = this.deps.getPrefs()
    const ctx = { worktree: rt.spec.worktree, autoMode: prefs.autoMode }
    let first: PolicyVerdict | null = null
    for (const req of requests) {
      const v = evaluatePolicy(req, prefs.policy, ctx)
      if (v.decision === 'ask') return v
      first ??= v
    }
    return first as PolicyVerdict
  }

  private onPermission(rt: Runtime, session: AgentSession, r: PermissionRequestEvent): void {
    const verdict = this.verdictFor(rt, r.requests)
    if (verdict.decision === 'auto') {
      session.approve(r.id, 'allow')
      this.addLog(rt, 'permission', `Auto-approved: ${r.summary}`)
      this.setStatus(rt, 'working', 'Working…')
      return
    }
    const request: PermissionRequestInfo = {
      id: r.id,
      agentId: rt.agentId,
      voyageId: rt.voyage.id,
      tool: r.tool,
      summary: r.summary,
      detail: r.detail,
      category: verdict.category,
      reason: verdict.reason,
      requestedAt: this.nowIso()
    }
    rt.pending.set(r.id, request)
    this.setStatus(rt, 'waiting', `Waiting for approval: ${r.summary}`)
    this.addLog(rt, 'permission', `Asking permission: ${r.summary} (${verdict.reason})`)
    this.activity(rt, 'approval', `${rt.spec.displayName} is asking permission: ${r.summary}`)
    this.deps.emit({ type: 'permissionRequest', request })
  }

  private resolvePending(rt: Runtime, id: string, outcome: PermissionOutcome, by: PermissionDecidedBy): void {
    const req = rt.pending.get(id)
    if (!req) return
    rt.pending.delete(id)
    this.deps.emit({ type: 'permissionResolved', agentId: rt.agentId, requestId: id, outcome, by })
    if (outcome === 'terminal') {
      this.addLog(rt, 'permission', `Answered in the terminal: ${req.summary}`)
    }
    if (rt.pending.size === 0 && rt.status === 'waiting') this.setStatus(rt, 'working', 'Working…')
    this.deps.emit({ type: 'activity' })
  }

  private cancelPending(rt: Runtime, outcome: PermissionOutcome, by: PermissionDecidedBy): void {
    for (const id of [...rt.pending.keys()]) this.resolvePending(rt, id, outcome, by)
  }

  /** The user's answer from the Den Den Mushi queue. */
  decide(agentId: string, requestId: string, decision: 'allow' | 'deny'): void {
    const rt = this.runtimes.get(agentId)
    const req = rt?.pending.get(requestId)
    if (!rt || !req) throw new Error('That request is no longer waiting. It may have been answered in the terminal.')
    if (!rt.session) throw new Error('That crew member is not running.')
    rt.session.approve(requestId, decision, decision === 'deny' ? 'Denied by the user via Den Den Mushi.' : undefined)
    this.resolvePending(rt, requestId, decision, 'user')
    const verb = decision === 'allow' ? 'allowed' : 'denied'
    this.addLog(rt, 'permission', `You ${verb}: ${req.summary}`)
    this.activity(rt, 'approval', `You ${verb} ${rt.spec.displayName}: ${req.summary}`)
    if (decision === 'allow') this.setStatus(rt, 'working', 'Approved. Carrying on.')
  }

  // ---- user input ----

  send(agentId: string, message: string): void {
    const rt = this.runtimes.get(agentId)
    if (!rt?.session) throw new Error('That crew member is not running. Put them on duty or retry their session.')
    const text = message.trim()
    if (!text) throw new Error('Type a message first.')
    if (text.length > MAX_SEND_LENGTH) throw new Error('That message is too long.')
    rt.session.send(text)
    this.addLog(rt, 'system', `You: ${text.length > 200 ? `${text.slice(0, 199)}…` : text}`)
  }

  write(agentId: string, data: string): void {
    this.runtimes.get(agentId)?.session?.write(data)
  }

  resize(agentId: string, cols: number, rows: number): void {
    const rt = this.runtimes.get(agentId)
    if (!rt) return
    rt.cols = Math.max(2, Math.min(500, Math.floor(cols)))
    rt.rows = Math.max(2, Math.min(200, Math.floor(rows)))
    rt.session?.resize(rt.cols, rt.rows)
  }

  // ---- views ----

  snapshot(): AgentSnapshot[] {
    return [...this.runtimes.values()].map((rt) => ({
      agentId: rt.agentId,
      running: !!rt.session,
      status: rt.status,
      statusText: rt.statusText,
      startedAt: rt.startedAt,
      error: rt.error,
      usage: rt.usage,
      pending: [...rt.pending.values()],
      log: rt.log
    }))
  }

  terminalBuffer(agentId: string): TerminalBuffer {
    const rt = this.runtimes.get(agentId)
    if (!rt) return { data: '', end: 0 }
    this.flush(rt)
    return { data: rt.buffer, end: rt.total }
  }

  // ---- internals ----

  private setStatus(rt: Runtime, status: LiveStatus, text: string): void {
    if (rt.status === status && rt.statusText === text) return
    rt.status = status
    rt.statusText = text
    this.deps.emit({ type: 'status', agentId: rt.agentId, status, statusText: text })
  }

  private addLog(rt: Runtime, kind: LogKind, text: string): void {
    const entry: LogEntry = { id: ++this.logSeq, at: this.nowIso(), kind, text }
    rt.log.push(entry)
    if (rt.log.length > MAX_LOG) rt.log.splice(0, rt.log.length - MAX_LOG)
    this.deps.emit({ type: 'log', agentId: rt.agentId, entry })
  }

  private activity(rt: Runtime, kind: string, message: string): void {
    try {
      this.deps.logActivity({ crewId: rt.voyage.crewId, voyageId: rt.voyage.id, agentId: rt.agentId, kind, message })
      this.deps.emit({ type: 'activity' })
    } catch {
      // activity logging must never break an agent
    }
  }

  private appendOutput(rt: Runtime, data: string): void {
    rt.buffer += data
    if (rt.buffer.length > MAX_BUFFER) rt.buffer = rt.buffer.slice(rt.buffer.length - MAX_BUFFER)
    rt.total += data.length
    rt.outBuf += data
    if (rt.outBuf.length >= FLUSH_MAX) this.flush(rt)
    else if (!rt.flushTimer) rt.flushTimer = setTimeout(() => this.flush(rt), FLUSH_MS)
  }

  private flush(rt: Runtime): void {
    if (rt.flushTimer) {
      clearTimeout(rt.flushTimer)
      rt.flushTimer = null
    }
    if (!rt.outBuf) return
    const data = rt.outBuf
    rt.outBuf = ''
    this.deps.emitOutput({ agentId: rt.agentId, data, end: rt.total })
  }
}
