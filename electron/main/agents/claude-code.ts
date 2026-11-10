import { spawn as spawnChild } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'
import type { UsageInfo } from '../../../shared/types/agents'
import { buildLaunch, resolveOnPath } from '../core/exec'
import { INTERACTIVE_TOOLS, describeTool, summarizeToolUse } from './claude-tools'
import type { HookServer, HookRequest, HookReply } from './hook-server'
import { DETECTION_TEXT, OutputMatcher } from './output-matcher'
import {
  SessionEmitter,
  type AgentConfig,
  type AgentProvider,
  type AgentSession,
  type ProviderSessionEventName,
  type ProviderSessionEvents
} from './provider'

/**
 * Claude Code CLI adapter.
 *
 * The real `claude` TUI runs in a node-pty pseudo-terminal (ConPTY on Windows) so
 * the user sees and can type into exactly what Claude Code shows. Status, tool
 * activity, permission prompts and usage come from Claude Code's own hooks and
 * status line, delivered to a loopback HTTP server, not from scraping the screen.
 */

export const CLAUDE_INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code'

/** Events delivered as HTTP hooks. (SessionStart does not support HTTP hooks; it uses a curl command hook.) */
const HOOK_EVENTS = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd'
] as const

/** Claude waits this long (seconds) for a Den Den Mushi decision before falling back to its own prompt. */
const PERMISSION_TIMEOUT_S = 3600
const FAST_HOOK_TIMEOUT_S = 10
const RESUME_FAILURE_WINDOW_MS = 15_000
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,63}$/

export interface ClaudeSettingsInput {
  hookUrl: string
  statusUrl: string
  platform: NodeJS.Platform
}

/** The per-session settings JSON passed with `--settings`. */
export function buildClaudeSettings({ hookUrl, statusUrl, platform }: ClaudeSettingsInput): Record<string, unknown> {
  const http = (timeout: number) => [{ hooks: [{ type: 'http', url: hookUrl, timeout }] }]
  // curl ships with Windows 10+, macOS and most Linux; `.exe` avoids PowerShell's curl alias.
  // The endpoint answers with an empty body, so a command hook adds nothing to Claude's context.
  const curl = platform === 'win32' ? 'curl.exe' : 'curl'
  const post = (url: string): string => `${curl} -s -m 5 -X POST -H "Content-Type: application/json" --data-binary @- "${url}"`
  const hooks: Record<string, unknown> = {
    SessionStart: [{ hooks: [{ type: 'command', command: post(hookUrl), timeout: FAST_HOOK_TIMEOUT_S }] }]
  }
  for (const event of HOOK_EVENTS) hooks[event] = http(FAST_HOOK_TIMEOUT_S)
  hooks.PermissionRequest = http(PERMISSION_TIMEOUT_S)
  return { hooks, statusLine: { type: 'command', command: post(statusUrl) } }
}

/** Environment for the child: our own env minus anything that makes Claude think it is nested. */
export function cleanEnv(base: NodeJS.ProcessEnv): Record<string, string> {
  const drop = new Set(['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'ELECTRON_RUN_AS_NODE'])
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && !drop.has(k)) env[k] = v
  }
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  return env
}

export interface ClaudeProviderOptions {
  hookServer: HookServer
  /** Where per-session settings and prompt files are written. */
  dataDir: string
  resolveClaude?: () => string | null
  spawnPty?: typeof pty.spawn
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = 'claude-code-cli'

  constructor(private readonly opts: ClaudeProviderOptions) {}

  async start(config: AgentConfig): Promise<AgentSession> {
    const file = (this.opts.resolveClaude ?? (() => resolveOnPath('claude')))()
    if (!file) {
      throw new Error(`The Claude Code CLI was not found on PATH. Install it with: ${CLAUDE_INSTALL_COMMAND}`)
    }
    if (config.model !== 'default' && !MODEL_RE.test(config.model)) {
      throw new Error(`"${config.model}" is not a valid model name.`)
    }
    const session = new ClaudeSession(config, file, this.opts)
    session.launch()
    return session
  }
}

type Decision = { behavior: 'allow' } | { behavior: 'deny'; message: string }

class ClaudeSession implements AgentSession {
  private readonly emitter = new SessionEmitter()
  private readonly matcher = new OutputMatcher()
  private readonly pending = new Map<string, (d: Decision) => void>()
  private readonly sessionDir: string
  private proc: pty.IPty | null = null
  private externalId: string
  private resumed: boolean
  private launchedAt = 0
  private sawSessionStart = false
  private stopping = false
  private unregister: (() => void) | null = null
  private exitWaiters: Array<() => void> = []
  private ended = false
  private model: string | null = null
  private cols: number
  private rows: number

  constructor(
    private readonly config: AgentConfig,
    private readonly file: string,
    private readonly opts: ClaudeProviderOptions
  ) {
    this.resumed = !!config.resumeSessionId
    this.externalId = config.resumeSessionId ?? randomUUID()
    this.cols = config.cols
    this.rows = config.rows
    this.sessionDir = path.join(opts.dataDir, 'sessions', config.agentId)
  }

  get pid(): number | null {
    return this.proc?.pid ?? null
  }

  on<E extends ProviderSessionEventName>(event: E, cb: (payload: ProviderSessionEvents[E]) => void): () => void {
    return this.emitter.on(event, cb)
  }

  launch(): void {
    const { hookServer } = this.opts
    mkdirSync(this.sessionDir, { recursive: true })
    const settingsFile = path.join(this.sessionDir, 'settings.json')
    const promptFile = path.join(this.sessionDir, 'system-prompt.md')
    writeFileSync(
      settingsFile,
      JSON.stringify(
        buildClaudeSettings({
          hookUrl: hookServer.urlFor(this.config.agentId, 'hook'),
          statusUrl: hookServer.urlFor(this.config.agentId, 'status'),
          platform: process.platform
        }),
        null,
        2
      ),
      { mode: 0o600 }
    )
    writeFileSync(promptFile, this.config.systemPrompt, 'utf8')

    // Grand Fleet owns the approval policy, so Claude must ask (default mode) rather than self-approve (auto mode).
    const args = ['--settings', settingsFile, '--permission-mode', 'default', '--append-system-prompt-file', promptFile]
    args.push(this.resumed ? '--resume' : '--session-id', this.externalId)
    if (this.config.model !== 'default') args.push('--model', this.config.model)
    // Diagnostics: set GRANDFLEET_CLAUDE_DEBUG_DIR to capture Claude's own debug log per agent.
    const debugDir = process.env.GRANDFLEET_CLAUDE_DEBUG_DIR
    if (debugDir) args.push('--debug-file', path.join(debugDir, `${this.config.agentId}.log`))

    const launch = buildLaunch(this.file, args)
    // node-pty on Windows takes a raw command-line string when we need cmd.exe's /s /c "..." form.
    const ptyArgs = launch.verbatim ? launch.args.join(' ') : launch.args
    const spawn = this.opts.spawnPty ?? pty.spawn

    this.unregister?.()
    this.unregister = hookServer.register(this.config.agentId, (req) => this.onHttp(req))
    this.sawSessionStart = false
    this.launchedAt = Date.now()
    // Deferred so listeners attached right after start() resolves still see these.
    const launchedId = this.externalId
    setTimeout(() => {
      this.emitter.emit('session', { externalId: launchedId, confirmed: false })
      if (!this.sawSessionStart) this.emitter.emit('status', { status: 'idle', text: 'Starting Claude Code...' })
    }, 0)

    this.proc = spawn(launch.command, ptyArgs, {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.config.cwd,
      env: cleanEnv(process.env),
      useConpty: true
    })
    const proc = this.proc
    proc.onData((data) => {
      if (proc !== this.proc) return
      this.emitter.emit('output', { data })
      const seen = this.matcher.feed(data)
      if (seen) this.emitter.emit('status', { status: 'waiting', text: DETECTION_TEXT[seen] })
    })
    proc.onExit(({ exitCode, signal }) => {
      if (proc !== this.proc) return
      this.onExit(exitCode, signal ?? null)
    })
  }

  private onExit(code: number | null, signal: number | null): void {
    const quickResumeFailure =
      !this.stopping &&
      this.resumed &&
      !this.sawSessionStart &&
      code !== 0 &&
      Date.now() - this.launchedAt < RESUME_FAILURE_WINDOW_MS
    if (quickResumeFailure) {
      // The stored conversation is gone (cleared, or the CLI was reinstalled). Start fresh instead of failing.
      this.resumed = false
      this.externalId = randomUUID()
      this.emitter.emit('output', {
        data: '\r\n\x1b[33m[Grand Fleet] Could not resume the previous conversation. Starting a new one.\x1b[0m\r\n'
      })
      try {
        this.launch()
        return
      } catch (err) {
        this.emitter.emit('output', { data: `\r\n[Grand Fleet] ${String(err)}\r\n` })
      }
    }
    this.finish(code, signal)
  }

  private finish(code: number | null, signal: number | null): void {
    if (this.ended) return
    this.ended = true
    this.unregister?.()
    this.unregister = null
    this.denyAllPending('The session ended.')
    rmSync(path.join(this.sessionDir, 'settings.json'), { force: true })
    this.emitter.emit('exit', { code, signal, requested: this.stopping })
    for (const w of this.exitWaiters.splice(0)) w()
  }

  // ---- AgentSession ----

  send(message: string, attachments: string[] = []): void {
    if (!this.proc || this.ended) throw new Error('This session is not running.')
    const text = [message, ...attachments.map((a) => `@${a}`)].join(' ')
    // Bracketed paste keeps multi-line text as one prompt; Enter submits it.
    this.write(`\x1b[200~${text}\x1b[201~`)
    setTimeout(() => this.write('\r'), 150)
  }

  write(data: string): void {
    try {
      this.proc?.write(data)
    } catch {
      // process already gone
    }
  }

  resize(cols: number, rows: number): void {
    this.cols = Math.max(2, Math.min(500, Math.floor(cols)))
    this.rows = Math.max(2, Math.min(200, Math.floor(rows)))
    try {
      this.proc?.resize(this.cols, this.rows)
    } catch {
      // process already gone
    }
  }

  approve(requestId: string, decision: 'allow' | 'deny', message?: string): void {
    const resolve = this.pending.get(requestId)
    if (!resolve) return
    this.pending.delete(requestId)
    resolve(decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: message ?? 'Denied by the user.' })
  }

  stop(): Promise<void> {
    if (this.ended || !this.proc) return Promise.resolve()
    this.stopping = true
    this.denyAllPending('The session was stopped.')
    const proc = this.proc
    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        // Never leave the caller hanging on a process that will not die.
        this.finish(null, null)
        resolve()
      }, 4000)
      this.exitWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
    killTree(proc)
    return done
  }

  private denyAllPending(message: string): void {
    for (const [id, resolve] of [...this.pending]) {
      this.pending.delete(id)
      resolve({ behavior: 'deny', message })
    }
  }

  // ---- hooks and status line ----

  private async onHttp(req: HookRequest): Promise<HookReply> {
    if (this.ended) return
    if (req.kind === 'status') return this.onStatusLine(req.body)
    return this.onHook(req)
  }

  private onStatusLine(body: Record<string, unknown>): HookReply {
    const ctx = (body.context_window ?? {}) as Record<string, unknown>
    const cost = (body.cost ?? {}) as Record<string, unknown>
    const model = (body.model ?? {}) as Record<string, unknown>
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    const usage: Partial<UsageInfo> = {
      contextPercent: num(ctx.used_percentage),
      contextWindowSize: num(ctx.context_window_size),
      inputTokens: num(ctx.total_input_tokens) ?? 0,
      outputTokens: num(ctx.total_output_tokens) ?? 0
    }
    const total = num(cost.total_cost_usd)
    if (total !== null) usage.costUsd = total
    this.model = typeof model.display_name === 'string' ? model.display_name : typeof model.id === 'string' ? model.id : this.model
    usage.model = this.model
    this.emitter.emit('usage', usage)
    const pct = usage.contextPercent === null || usage.contextPercent === undefined ? '' : ` | ctx ${Math.round(usage.contextPercent)}%`
    return { text: `${this.config.displayName}${pct}` }
  }

  private async onHook(req: HookRequest): Promise<HookReply> {
    const body = req.body
    const event = typeof body.hook_event_name === 'string' ? body.hook_event_name : ''
    const tool = typeof body.tool_name === 'string' ? body.tool_name : ''
    const input = body.tool_input
    const cwd = this.config.cwd

    switch (event) {
      case 'SessionStart': {
        this.sawSessionStart = true
        const id = typeof body.session_id === 'string' ? body.session_id : this.externalId
        this.externalId = id
        this.emitter.emit('session', { externalId: id, confirmed: true })
        this.emitter.emit('status', { status: 'idle', text: 'Ready for orders.' })
        return
      }
      case 'UserPromptSubmit': {
        const prompt = typeof body.prompt === 'string' ? body.prompt.replace(/\s+/g, ' ').trim() : ''
        this.emitter.emit('status', { status: 'working', text: prompt ? `On it: ${prompt.slice(0, 80)}` : 'Working...' })
        return
      }
      case 'PreToolUse': {
        const summary = summarizeToolUse(tool, input, cwd)
        this.emitter.emit('toolCall', { phase: 'start', tool, summary })
        this.emitter.emit('status', { status: 'working', text: summary })
        return
      }
      case 'PostToolUse':
        this.emitter.emit('toolCall', { phase: 'end', tool, summary: summarizeToolUse(tool, input, cwd), ok: true })
        this.emitter.emit('status', { status: 'working', text: 'Working...' })
        return
      case 'PostToolUseFailure':
        this.emitter.emit('toolCall', { phase: 'end', tool, summary: summarizeToolUse(tool, input, cwd), ok: false })
        return
      case 'PermissionRequest':
        return this.onPermission(req, tool, input)
      case 'Stop': {
        const last = typeof body.last_assistant_message === 'string' ? body.last_assistant_message : null
        this.emitter.emit('status', { status: 'idle', text: 'Awaiting orders.' })
        this.emitter.emit('turn', { message: last })
        return
      }
      case 'StopFailure': {
        const detail = typeof body.error === 'string' ? body.error : 'the request failed'
        this.emitter.emit('status', { status: 'error', text: `Hit a snag: ${detail}` })
        return
      }
      default:
        return
    }
  }

  private async onPermission(req: HookRequest, tool: string, input: unknown): Promise<HookReply> {
    if (INTERACTIVE_TOOLS.has(tool)) {
      // These need a human answer inside Claude's own dialog. Make no decision.
      this.emitter.emit('status', { status: 'waiting', text: `${tool} needs your answer in the terminal.` })
      return
    }
    const described = describeTool(tool, input, this.config.cwd)
    const id = randomUUID()
    const decision = new Promise<Decision | 'gone'>((resolve) => {
      this.pending.set(id, resolve)
      req.signal.addEventListener(
        'abort',
        () => {
          if (this.pending.delete(id)) resolve('gone')
        },
        { once: true }
      )
    })
    this.emitter.emit('permissionRequest', {
      id,
      tool,
      summary: described.summary,
      detail: described.detail,
      requests: described.requests
    })
    const result = await decision
    if (result === 'gone') {
      // Claude hung up: the user answered in the terminal (or its own timeout hit).
      this.emitter.emit('permissionCancelled', { id, reason: 'terminal' })
      return
    }
    return {
      json: {
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: result.behavior === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: result.message, interrupt: false }
        }
      }
    }
  }
}

/** Kill the process and its children; ConPTY children can outlive the pty on Windows. */
function killTree(proc: pty.IPty): void {
  const pid = proc.pid
  try {
    proc.kill()
  } catch {
    // already dead
  }
  if (process.platform === 'win32' && pid) {
    const t = spawnChild('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    t.on('error', () => undefined)
  }
}
