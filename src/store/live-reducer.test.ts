import { describe, expect, it } from 'vitest'
import type { AgentEvent, PermissionRequestInfo } from '@shared/types/agents'
import { applyEvent, blank, type AgentLive } from './live-reducer'

const req = (id: string, agentId = 'zoro'): PermissionRequestInfo => ({
  id,
  agentId,
  voyageId: 'v',
  tool: 'Bash',
  summary: 's',
  detail: 'd',
  category: 'install',
  reason: 'r',
  requestedAt: '2026-01-01T00:00:00.000Z'
})

const run = (events: AgentEvent[], start: Record<string, AgentLive> = {}) => events.reduce(applyEvent, start)

describe('applyEvent', () => {
  it('creates an entry lazily when events arrive before the snapshot', () => {
    const live = run([{ type: 'status', agentId: 'zoro', status: 'working', statusText: 'Run: ls' }])
    expect(live.zoro).toMatchObject({ status: 'working', statusText: 'Run: ls', running: false })
  })

  it('tracks running, then drops the entry when the agent stands down', () => {
    let live = run([{ type: 'running', agentId: 'zoro', running: true, startedAt: '2026-01-01T00:00:00.000Z', error: null }])
    expect(live.zoro.running).toBe(true)
    expect(live.zoro.startedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'))
    live = applyEvent(live, { type: 'running', agentId: 'zoro', running: false, startedAt: null, error: null })
    expect(live.zoro).toBeUndefined()
  })

  it('keeps a failed session visible with its error', () => {
    const live = run([{ type: 'running', agentId: 'zoro', running: false, startedAt: null, error: 'CLI not found' }])
    expect(live.zoro).toMatchObject({ running: false, error: 'CLI not found' })
  })

  it('queues permission requests once and clears them when resolved', () => {
    let live = run([{ type: 'permissionRequest', request: req('a') }, { type: 'permissionRequest', request: req('a') }])
    expect(live.zoro.pending).toHaveLength(1)
    live = applyEvent(live, { type: 'permissionRequest', request: req('b') })
    expect(live.zoro.pending.map((p) => p.id)).toEqual(['a', 'b'])
    live = applyEvent(live, { type: 'permissionResolved', agentId: 'zoro', requestId: 'a', outcome: 'allow', by: 'user' })
    expect(live.zoro.pending.map((p) => p.id)).toEqual(['b'])
  })

  it('caps the log at 500 entries, dropping the oldest', () => {
    let live: Record<string, AgentLive> = { zoro: blank() }
    for (let i = 1; i <= 520; i++) {
      live = applyEvent(live, { type: 'log', agentId: 'zoro', entry: { id: i, at: 't', kind: 'tool', text: `t${i}` } })
    }
    expect(live.zoro.log).toHaveLength(500)
    expect(live.zoro.log[0].text).toBe('t21')
    expect(live.zoro.log.at(-1)?.text).toBe('t520')
  })

  it('stores usage and ignores activity hints without changing state', () => {
    const usage = { contextPercent: 7, contextWindowSize: 200000, costUsd: 0.1, inputTokens: 5, outputTokens: 1, model: 'x' }
    const live = run([{ type: 'usage', agentId: 'zoro', usage }])
    expect(live.zoro.usage).toEqual(usage)
    expect(applyEvent(live, { type: 'activity' })).toBe(live)
  })

  it('does not mutate previous state', () => {
    const before = run([{ type: 'status', agentId: 'zoro', status: 'idle', statusText: 'a' }])
    const snapshot = JSON.stringify(before)
    applyEvent(before, { type: 'status', agentId: 'zoro', status: 'working', statusText: 'b' })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
