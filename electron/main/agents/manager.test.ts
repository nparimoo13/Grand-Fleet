import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent, AgentOutputChunk } from '../../../shared/types/agents'
import { DEFAULT_PREFERENCES, type AppPreferences } from '../../../shared/types/app'
import { AgentManager, type AgentStartSpec, type ActivityInput, type SessionStore } from './manager'
import {
  SessionEmitter,
  type AgentConfig,
  type AgentProvider,
  type AgentSession,
  type PermissionRequestEvent,
  type ProviderSessionEventName,
  type ProviderSessionEvents
} from './provider'

const WT = path.resolve('/tmp/voyage/.grandfleet/worktrees/zoro')
const voyage = { id: 'v1', crewId: 'strawhats', path: path.resolve('/tmp/voyage') }

class FakeSession implements AgentSession {
  pid = 1
  emitter = new SessionEmitter()
  approvals: Array<{ id: string; decision: string; message?: string }> = []
  sent: string[] = []
  written: string[] = []
  stopped = false
  resizes: Array<[number, number]> = []
  on<E extends ProviderSessionEventName>(event: E, cb: (p: ProviderSessionEvents[E]) => void): () => void {
    return this.emitter.on(event, cb)
  }
  emit<E extends ProviderSessionEventName>(event: E, payload: ProviderSessionEvents[E]): void {
    this.emitter.emit(event, payload)
  }
  send(message: string): void {
    this.sent.push(message)
  }
  write(data: string): void {
    this.written.push(data)
  }
  resize(cols: number, rows: number): void {
    this.resizes.push([cols, rows])
  }
  approve(id: string, decision: 'allow' | 'deny', message?: string): void {
    this.approvals.push({ id, decision, message })
  }
  async stop(): Promise<void> {
    this.stopped = true
  }
}

class FakeProvider implements AgentProvider {
  id = 'claude-code-cli'
  sessions: FakeSession[] = []
  configs: AgentConfig[] = []
  failWith: string | null = null
  async start(config: AgentConfig): Promise<AgentSession> {
    if (this.failWith) throw new Error(this.failWith)
    this.configs.push(config)
    const s = new FakeSession()
    this.sessions.push(s)
    return s
  }
}

function makeStore(): SessionStore & { rows: Array<Record<string, unknown>>; resumable: string | null } {
  const store = {
    rows: [] as Array<Record<string, unknown>>,
    resumable: null as string | null,
    begin: (row: Record<string, unknown>) => void store.rows.push({ ...row }),
    setExternal: (id: string, externalId: string, confirmed: boolean) => {
      const r = store.rows.find((x) => x.id === id)
      if (r) Object.assign(r, { externalId, confirmed })
    },
    lastResumable: () => store.resumable,
    updateCost: (id: string, costUsd: number) => {
      const r = store.rows.find((x) => x.id === id)
      if (r) r.costUsd = costUsd
    },
    end: (id: string, status: string) => {
      const r = store.rows.find((x) => x.id === id)
      if (r) r.endStatus = status
    }
  }
  return store
}

const spec: AgentStartSpec = {
  agentId: 'zoro',
  displayName: 'Zoro',
  worktree: WT,
  providerId: 'claude-code-cli',
  model: 'default',
  systemPrompt: 'You are Zoro.'
}

function perm(over: Partial<PermissionRequestEvent> = {}): PermissionRequestEvent {
  return {
    id: 'r1',
    tool: 'Bash',
    summary: 'Run: pnpm install',
    detail: 'pnpm install',
    requests: [{ kind: 'shell', command: 'pnpm install' }],
    ...over
  }
}

describe('AgentManager', () => {
  let provider: FakeProvider
  let store: ReturnType<typeof makeStore>
  let prefs: AppPreferences
  let events: AgentEvent[]
  let outputs: AgentOutputChunk[]
  let activity: ActivityInput[]
  let mgr: AgentManager

  beforeEach(() => {
    provider = new FakeProvider()
    store = makeStore()
    prefs = structuredClone(DEFAULT_PREFERENCES)
    events = []
    outputs = []
    activity = []
    mgr = new AgentManager({
      providers: (id) => (id === provider.id ? provider : null),
      getPrefs: () => prefs,
      store,
      logActivity: (a) => activity.push(a),
      emit: (e) => events.push(e),
      emitOutput: (c) => outputs.push(c)
    })
  })

  const session = (): FakeSession => provider.sessions[provider.sessions.length - 1]
  const types = (): string[] => events.map((e) => e.type)

  it('starts a session with the spec, persists it and reports running', async () => {
    store.resumable = 'abc-123'
    await mgr.start(voyage, spec)
    expect(provider.configs[0]).toMatchObject({ cwd: WT, model: 'default', systemPrompt: 'You are Zoro.', resumeSessionId: 'abc-123' })
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({ agentId: 'zoro', crewId: 'strawhats', voyageId: 'v1', externalId: 'abc-123' })
    expect(events).toContainEqual(expect.objectContaining({ type: 'running', agentId: 'zoro', running: true }))
    expect(mgr.snapshot()[0]).toMatchObject({ agentId: 'zoro', running: true, status: 'idle' })
  })

  it('turns a missing provider into a retryable error state instead of throwing', async () => {
    await mgr.start(voyage, { ...spec, providerId: 'codex-cli' })
    const snap = mgr.snapshot()[0]
    expect(snap.running).toBe(false)
    expect(snap.status).toBe('error')
    expect(snap.error).toMatch(/not wired up/)
  })

  it('turns a provider start failure into an error state with the message', async () => {
    provider.failWith = 'The Claude Code CLI was not found on PATH.'
    await mgr.start(voyage, spec)
    expect(mgr.snapshot()[0]).toMatchObject({ running: false, status: 'error', error: 'The Claude Code CLI was not found on PATH.' })
    expect(activity.some((a) => a.kind === 'error')).toBe(true)
    // and a retry works once the cause is fixed
    provider.failWith = null
    await mgr.start(voyage, spec)
    expect(mgr.snapshot()[0]).toMatchObject({ running: true, error: null })
  })

  describe('permissions', () => {
    it('auto-approves in-policy requests when auto mode is on, without queueing', async () => {
      prefs.autoMode = true
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'a', tool: 'Edit', summary: 'Edit f', requests: [{ kind: 'edit', path: path.join(WT, 'src', 'a.ts') }] }))
      expect(session().approvals).toEqual([{ id: 'a', decision: 'allow', message: undefined }])
      expect(mgr.snapshot()[0].pending).toHaveLength(0)
      expect(types()).not.toContain('permissionRequest')
    })

    it('queues everything when auto mode is off', async () => {
      prefs.autoMode = false
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'a', requests: [{ kind: 'read', path: path.join(WT, 'a.ts') }] }))
      expect(session().approvals).toHaveLength(0)
      const snap = mgr.snapshot()[0]
      expect(snap.pending).toHaveLength(1)
      expect(snap.status).toBe('waiting')
      expect(snap.pending[0].reason).toMatch(/auto mode is off/)
    })

    it.each([
      ['rm -rf build', 'delete'],
      ['pnpm install lodash', 'install'],
      ['git push origin main', 'git_remote_history'],
      ['somecustomtool --go', 'unlisted_shell']
    ])('always asks for %s even in auto mode (%s)', async (command, category) => {
      prefs.autoMode = true
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'x', summary: command, detail: command, requests: [{ kind: 'shell', command }] }))
      expect(session().approvals).toHaveLength(0)
      expect(mgr.snapshot()[0].pending[0].category).toBe(category)
    })

    it('asks for edits outside the worktree', async () => {
      prefs.autoMode = true
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'o', tool: 'Write', requests: [{ kind: 'edit', path: path.resolve('/etc/hosts') }] }))
      expect(mgr.snapshot()[0].pending[0].category).toBe('outside_worktree')
    })

    it('asks for unrecognized tools (requests = null)', async () => {
      prefs.autoMode = true
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'u', tool: 'mcp__x__y', summary: 'Use MCP tool', requests: null }))
      expect(mgr.snapshot()[0].pending).toHaveLength(1)
    })

    it('asks if any one of several requests needs approval', async () => {
      prefs.autoMode = true
      await mgr.start(voyage, spec)
      session().emit(
        'permissionRequest',
        perm({
          id: 'm',
          requests: [
            { kind: 'read', path: path.join(WT, 'a') },
            { kind: 'shell', command: 'rm a' }
          ]
        })
      )
      expect(mgr.snapshot()[0].pending).toHaveLength(1)
    })

    it('allow: forwards to the provider, clears the queue and logs activity', async () => {
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm())
      mgr.decide('zoro', 'r1', 'allow')
      expect(session().approvals).toEqual([{ id: 'r1', decision: 'allow', message: undefined }])
      expect(mgr.snapshot()[0].pending).toHaveLength(0)
      expect(mgr.snapshot()[0].status).toBe('working')
      expect(events).toContainEqual({ type: 'permissionResolved', agentId: 'zoro', requestId: 'r1', outcome: 'allow', by: 'user' })
      expect(activity.map((a) => a.message).join('\n')).toMatch(/You allowed Zoro/)
    })

    it('deny: forwards a denial message to the provider', async () => {
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm())
      mgr.decide('zoro', 'r1', 'deny')
      expect(session().approvals[0]).toMatchObject({ id: 'r1', decision: 'deny' })
      expect(session().approvals[0].message).toMatch(/Denied/)
    })

    it('rejects a decision for a request that no longer waits', async () => {
      await mgr.start(voyage, spec)
      expect(() => mgr.decide('zoro', 'nope', 'allow')).toThrow(/no longer waiting/)
    })

    it('drops a request answered in the terminal', async () => {
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm())
      session().emit('permissionCancelled', { id: 'r1', reason: 'terminal' })
      expect(mgr.snapshot()[0].pending).toHaveLength(0)
      expect(events).toContainEqual(expect.objectContaining({ type: 'permissionResolved', outcome: 'terminal', by: 'terminal' }))
      expect(() => mgr.decide('zoro', 'r1', 'allow')).toThrow()
    })

    it('respects policy edits made while the app runs', async () => {
      prefs.autoMode = true
      prefs.policy = structuredClone(prefs.policy)
      prefs.policy.categories.edit_in_worktree = 'ask'
      await mgr.start(voyage, spec)
      session().emit('permissionRequest', perm({ id: 'e', tool: 'Edit', requests: [{ kind: 'edit', path: path.join(WT, 'a') }] }))
      expect(mgr.snapshot()[0].pending).toHaveLength(1)
    })
  })

  describe('lifecycle', () => {
    it('stop kills the session, resolves pending requests and forgets the runtime', async () => {
      await mgr.start(voyage, spec)
      const s = session()
      s.emit('permissionRequest', perm())
      await mgr.stop('zoro')
      expect(s.stopped).toBe(true)
      expect(mgr.has('zoro')).toBe(false)
      expect(events).toContainEqual(expect.objectContaining({ type: 'permissionResolved', outcome: 'stopped' }))
      expect(store.rows[0].endStatus).toBe('stopped')
    })

    it('start on a running agent restarts it and keeps terminal history', async () => {
      await mgr.start(voyage, spec)
      const first = session()
      first.emit('output', { data: 'hello' })
      await mgr.start(voyage, spec)
      expect(first.stopped).toBe(true)
      expect(provider.sessions).toHaveLength(2)
      expect(mgr.terminalBuffer('zoro').data).toContain('hello')
    })

    it('ignores late events from a replaced session', async () => {
      await mgr.start(voyage, spec)
      const first = session()
      await mgr.start(voyage, spec)
      first.emit('permissionRequest', perm({ id: 'late' }))
      first.emit('status', { status: 'working', text: 'ghost' })
      expect(mgr.snapshot()[0].pending).toHaveLength(0)
      expect(mgr.snapshot()[0].statusText).not.toBe('ghost')
    })

    it('an unexpected exit becomes an error the user can retry', async () => {
      await mgr.start(voyage, spec)
      const s = session()
      s.emit('permissionRequest', perm())
      s.emit('exit', { code: 1, signal: null, requested: false })
      const snap = mgr.snapshot()[0]
      expect(snap).toMatchObject({ running: false, status: 'error' })
      expect(snap.error).toMatch(/exit code 1/)
      expect(snap.pending).toHaveLength(0)
      expect(store.rows[0].endStatus).toBe('exited')
    })

    it('switching voyage stops the previous voyage sessions', async () => {
      await mgr.start(voyage, spec)
      const s = session()
      await mgr.attachVoyage({ id: 'v2', crewId: 'strawhats', path: path.resolve('/tmp/other') })
      expect(s.stopped).toBe(true)
      expect(mgr.snapshot()).toHaveLength(0)
    })
  })

  describe('status, usage, input', () => {
    it('applies status, usage and turn events', async () => {
      await mgr.start(voyage, spec)
      const s = session()
      s.emit('status', { status: 'working', text: 'Run: pnpm test' })
      expect(mgr.snapshot()[0]).toMatchObject({ status: 'working', statusText: 'Run: pnpm test' })
      s.emit('usage', { contextPercent: 42, costUsd: 0.5, model: 'Opus' })
      expect(mgr.snapshot()[0].usage).toMatchObject({ contextPercent: 42, costUsd: 0.5, model: 'Opus' })
      expect(store.rows[0].costUsd).toBe(0.5)
      s.emit('turn', { message: 'All done.' })
      expect(activity.some((a) => a.kind === 'task' && /All done/.test(a.message))).toBe(true)
    })

    it('a partial usage update keeps earlier fields', async () => {
      await mgr.start(voyage, spec)
      session().emit('usage', { contextPercent: 10, costUsd: 1 })
      session().emit('usage', { contextPercent: 20 })
      expect(mgr.snapshot()[0].usage).toMatchObject({ contextPercent: 20, costUsd: 1 })
    })

    it('tool calls land in the log', async () => {
      await mgr.start(voyage, spec)
      session().emit('toolCall', { phase: 'start', tool: 'Bash', summary: 'Run: ls' })
      session().emit('toolCall', { phase: 'end', tool: 'Bash', summary: 'Run: ls', ok: false })
      const texts = mgr.snapshot()[0].log.map((l) => l.text)
      expect(texts).toContain('Run: ls')
      expect(texts.some((t) => t.startsWith('Tool failed'))).toBe(true)
    })

    it('send validates and forwards; write/resize pass through', async () => {
      await mgr.start(voyage, spec)
      mgr.send('zoro', '  hello  ')
      expect(session().sent).toEqual(['hello'])
      expect(() => mgr.send('zoro', '   ')).toThrow()
      mgr.write('zoro', 'abc')
      mgr.resize('zoro', 100, 30)
      expect(session().written).toEqual(['abc'])
      expect(session().resizes).toEqual([[100, 30]])
      expect(() => mgr.send('nobody', 'x')).toThrow(/not running/)
    })

    it('numbers terminal output so a late joiner can drop duplicates', async () => {
      await mgr.start(voyage, spec)
      session().emit('output', { data: 'abc' })
      session().emit('output', { data: 'def' })
      const buf = mgr.terminalBuffer('zoro')
      expect(buf).toEqual({ data: 'abcdef', end: 6 })
      expect(outputs.at(-1)).toEqual({ agentId: 'zoro', data: 'abcdef', end: 6 })
    })

    it('caps the replay buffer', async () => {
      await mgr.start(voyage, spec)
      const big = 'x'.repeat(100_000)
      for (let i = 0; i < 6; i++) session().emit('output', { data: big })
      const buf = mgr.terminalBuffer('zoro')
      expect(buf.data.length).toBe(400_000)
      expect(buf.end).toBe(600_000)
    })
  })
})
