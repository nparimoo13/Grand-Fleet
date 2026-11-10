import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/types/agents'
import { DEFAULT_PREFERENCES } from '../../../shared/types/app'
import { ClaudeCodeProvider } from './claude-code'
import { HookServer } from './hook-server'
import { AgentManager, type SessionStore } from './manager'

/**
 * Opt-in live test against the real `claude` binary. It spends a few tokens on the
 * cheapest model. Run with:  GRANDFLEET_LIVE_CLAUDE=1 pnpm vitest run claude-live
 */
const live = process.env.GRANDFLEET_LIVE_CLAUDE === '1'

const ext: { id: string | null; confirmed: boolean } = { id: null, confirmed: false }
const store: SessionStore = {
  begin: () => undefined,
  setExternal: (_row, externalId, confirmed) => {
    ext.confirmed = ext.id === externalId ? ext.confirmed || confirmed : confirmed
    ext.id = externalId
  },
  lastResumable: () => (ext.confirmed ? ext.id : null),
  updateCost: () => undefined,
  end: () => undefined
}

async function until<T>(what: string, fn: () => T | undefined | false, ms: number, dump: () => string): Promise<T> {
  const start = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - start > ms) throw new Error(`Timed out waiting for: ${what}\n--- terminal tail ---\n${dump()}`)
    await new Promise((r) => setTimeout(r, 200))
  }
}

describe.skipIf(!live)('Claude Code live', () => {
  const work = realpathSync(mkdtempSync(path.join(tmpdir(), 'gf-live-')))
  const data = mkdtempSync(path.join(tmpdir(), 'gf-live-data-'))
  const server = new HookServer()
  const events: AgentEvent[] = []
  let manager: AgentManager

  afterAll(async () => {
    await manager?.dispose()
    await server.stop()
    // Windows may hold the folder for a moment after the process tree dies; cleanup is best-effort.
    for (const dir of [work, data]) {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
      } catch {
        // temp folder, harmless
      }
    }
  })

  it('runs a real session: status, usage, permission queue, approval, completion', async () => {
    await server.start()
    const provider = new ClaudeCodeProvider({ hookServer: server, dataDir: data })
    const prefs = structuredClone(DEFAULT_PREFERENCES)
    prefs.autoMode = false
    manager = new AgentManager({
      providers: () => provider,
      getPrefs: () => prefs,
      store,
      logActivity: () => undefined,
      emit: (e) => events.push(e),
      emitOutput: () => undefined
    })
    const tail = (): string =>
      manager
        .terminalBuffer('zoro')
        .data.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
        .slice(-1500)
    const snap = () => manager.snapshot()[0]

    await manager.start(
      { id: 'v', crewId: 'strawhats', path: work },
      { agentId: 'zoro', displayName: 'Zoro', worktree: work, providerId: 'claude-code-cli', model: 'haiku', systemPrompt: 'You are Zoro. Be extremely brief.' }
    )
    expect(snap().running).toBe(true)

    // A fresh folder shows Claude's trust dialog; our output matcher must notice, then we accept it as a user would.
    let trusted = false
    await until(
      'SessionStart (Ready for orders)',
      () => {
        if (!trusted && /trust/i.test(snap().statusText)) {
          trusted = true
          // The dialog highlights "No, exit" first: arrow down to "Yes, I trust this folder", then confirm.
          setTimeout(() => manager.write('zoro', '\u001b[B'), 2000)
          setTimeout(() => manager.write('zoro', '\r'), 2600)
        }
        return snap().statusText === 'Ready for orders.'
      },
      90_000,
      tail
    )
    console.log('[live] trust dialog seen:', trusted)

    manager.send('zoro', 'Create a file named hello.txt in the current directory containing exactly the word hi. Use the Write tool. Then reply with the single word done.')

    const req = await until(
      'a permission request in the queue',
      () => snap().pending[0],
      120_000,
      tail
    )
    console.log('[live] permission request:', JSON.stringify(req))
    expect(snap().status).toBe('waiting')
    expect(req.tool).toBe('Write')
    expect(req.detail.toLowerCase()).toContain('hello.txt')

    manager.decide('zoro', req.id, 'allow')

    await until('turn finished', () => snap().log.some((l) => l.kind === 'task'), 120_000, tail)
    await until('idle after the turn', () => snap().status === 'idle', 20_000, tail)

    const file = path.join(work, 'hello.txt')
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf8').trim()).toBe('hi')

    // status-line usage arrived through the curl command
    await until('usage from the status line', () => snap().usage.contextPercent !== null, 20_000, tail)
    console.log('[live] usage:', JSON.stringify(snap().usage))
    console.log('[live] log:\n' + snap().log.map((l) => `  ${l.kind}: ${l.text}`).join('\n'))
    expect(snap().usage.costUsd).toBeGreaterThan(0)

    // ---- deny: rm is a delete, which must ask even in auto mode ----
    prefs.autoMode = true
    manager.send('zoro', 'Run exactly this shell command with the Bash tool: rm hello.txt   Then reply with the single word finished.')
    const del = await until('a delete request in the queue', () => snap().pending[0], 120_000, tail)
    console.log('[live] delete request:', del.tool, del.category)
    expect(del.category).toBe('delete')
    manager.decide('zoro', del.id, 'deny')
    await until('second turn finished', () => snap().log.filter((l) => l.kind === 'task').length >= 2, 120_000, tail)
    expect(existsSync(file)).toBe(true)

    // ---- stop, then resume the same conversation ----
    const confirmedId = ext.id
    expect(ext.confirmed).toBe(true)
    await manager.stop('zoro')
    expect(manager.has('zoro')).toBe(false)
    await manager.start(
      { id: 'v', crewId: 'strawhats', path: work },
      { agentId: 'zoro', displayName: 'Zoro', worktree: work, providerId: 'claude-code-cli', model: 'haiku', systemPrompt: 'You are Zoro. Be extremely brief.' }
    )
    await until('resumed session ready', () => manager.snapshot()[0]?.statusText === 'Ready for orders.', 60_000, tail)
    expect(ext.id).toBe(confirmedId)
    expect(tail()).not.toMatch(/Could not resume/)
  }, 420_000)
})
