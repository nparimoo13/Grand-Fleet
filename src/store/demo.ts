import type { CrewPack } from '@shared/ipc'
import { OFF_DUTY_RUNTIME, type ActivityItem, type AgentRuntime, type Bounty, type DenDenRequest } from './types'

export interface DemoData {
  activeIds: string[]
  runtime: Record<string, AgentRuntime>
  bounties: Bounty[]
  denDen: DenDenRequest[]
  activity: ActivityItem[]
}

/**
 * Fixture shown when no voyage is open. Built purely from crew data (order,
 * roles, display names), so it works for any crew pack.
 */
export function buildDemo(pack: CrewPack, now = Date.now()): DemoData {
  const chars = pack.characters
  const captain = chars.find((c) => c.id === pack.captainId) ?? chars[0]
  const crew = chars.filter((c) => c.id !== captain.id)
  const [a, b, c, d] = crew
  const min = 60_000
  const runtime: Record<string, AgentRuntime> = {}
  for (const ch of chars) runtime[ch.id] = OFF_DUTY_RUNTIME

  const set = (id: string | undefined, status: AgentRuntime['status'], line: string, ctx: number, minsAgo: number) => {
    if (!id) return
    runtime[id] = {
      status,
      statusLine: line,
      contextPercent: ctx,
      contextTokens: Math.round(ctx * 2000),
      costUsd: Math.round(ctx * 3) / 100,
      startedAt: now - minsAgo * min,
      running: true,
      error: null
    }
  }
  set(captain.id, 'idle', 'Awaiting orders.', 12, 22)
  set(a?.id, 'working', `Working as ${a?.role.toLowerCase() ?? 'crew'}…`, 34, 18)
  set(b?.id, 'waiting', 'Waiting for your approval.', 41, 9)
  set(c?.id, 'working', `Working as ${c?.role.toLowerCase() ?? 'crew'}…`, 27, 31)
  set(d?.id, 'error', 'Command failed. Check the log.', 63, 14)

  const active = [captain, a, b, c, d].filter((x): x is NonNullable<typeof x> => !!x)
  return {
    activeIds: active.map((x) => x.id),
    runtime,
    bounties: [
      { id: 'd1', title: 'Survey the project layout', assigneeId: c?.id ?? null, column: 'done' },
      { id: 'd2', title: 'Draft the implementation plan', assigneeId: a?.id ?? null, column: 'in_progress' },
      { id: 'd3', title: 'Fix the failing build', assigneeId: d?.id ?? null, column: 'in_progress' },
      { id: 'd4', title: 'Add integration tests', assigneeId: b?.id ?? null, column: 'todo' }
    ],
    denDen: b
      ? [{ id: 'dd1', agentId: b.id, summary: 'Run a command', detail: 'pnpm install left-pad', at: now - 2 * min }]
      : [],
    activity: [
      { id: 'x1', at: new Date(now - 5 * min).toISOString(), message: `${a?.displayName ?? 'A crew member'} picked up “Draft the implementation plan”.` },
      { id: 'x2', at: new Date(now - 3 * min).toISOString(), message: `${c?.displayName ?? 'A crew member'} finished “Survey the project layout”.` },
      { id: 'x3', at: new Date(now - 1 * min).toISOString(), message: `${b?.displayName ?? 'A crew member'} is waiting for approval.` }
    ]
  }
}
