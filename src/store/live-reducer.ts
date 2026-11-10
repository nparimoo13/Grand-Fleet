import {
  EMPTY_USAGE,
  type AgentEvent,
  type AgentSnapshot,
  type LiveStatus,
  type LogEntry,
  type PermissionRequestInfo,
  type UsageInfo
} from '@shared/types/agents'

/** Live state of one running (or failed) agent session, mirrored from the main process. */
export interface AgentLive {
  running: boolean
  status: LiveStatus
  statusText: string
  startedAt: number | null
  error: string | null
  usage: UsageInfo
  pending: PermissionRequestInfo[]
  log: LogEntry[]
}

const MAX_LOG = 500

export function blank(): AgentLive {
  return {
    running: false,
    status: 'idle',
    statusText: 'Standing by.',
    startedAt: null,
    error: null,
    usage: { ...EMPTY_USAGE },
    pending: [],
    log: []
  }
}

export function fromSnapshot(s: AgentSnapshot): AgentLive {
  return {
    running: s.running,
    status: s.status,
    statusText: s.statusText,
    startedAt: s.startedAt ? Date.parse(s.startedAt) : null,
    error: s.error,
    usage: s.usage,
    pending: s.pending,
    log: s.log.slice(-MAX_LOG)
  }
}

export function applyEvent(live: Record<string, AgentLive>, event: AgentEvent): Record<string, AgentLive> {
  if (event.type === 'activity') return live

  if (event.type === 'permissionRequest') {
    const id = event.request.agentId
    const cur = live[id] ?? blank()
    if (cur.pending.some((p) => p.id === event.request.id)) return live
    return { ...live, [id]: { ...cur, pending: [...cur.pending, event.request] } }
  }

  const id = event.agentId
  const cur = live[id] ?? blank()
  switch (event.type) {
    case 'status':
      return { ...live, [id]: { ...cur, status: event.status, statusText: event.statusText } }
    case 'running': {
      if (!event.running && event.error === null) {
        // Stood down: the session and its runtime are gone.
        const { [id]: _gone, ...rest } = live
        return rest
      }
      return { ...live, [id]: { ...cur, running: event.running, startedAt: event.startedAt ? Date.parse(event.startedAt) : null, error: event.error } }
    }
    case 'log': {
      const log = cur.log.length >= MAX_LOG ? [...cur.log.slice(1), event.entry] : [...cur.log, event.entry]
      return { ...live, [id]: { ...cur, log } }
    }
    case 'usage':
      return { ...live, [id]: { ...cur, usage: event.usage } }
    case 'permissionResolved':
      return { ...live, [id]: { ...cur, pending: cur.pending.filter((p) => p.id !== event.requestId) } }
  }
}

