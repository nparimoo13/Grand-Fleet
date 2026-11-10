import { useEffect, useRef } from 'react'
import type { LogKind } from '@shared/ipc'
import { useAppStore, useSelectedAgent } from '@/store/app-store'
import { useLiveStore } from '@/store/live-store'

const KIND_LABEL: Record<LogKind, string> = {
  tool: 'tool',
  permission: 'approval',
  task: 'turn',
  error: 'error',
  status: 'status',
  system: 'note'
}

/** Structured per-agent log: tool calls, approvals, finished turns and errors. */
export function LogPanel() {
  const agent = useSelectedAgent()
  const demo = useAppStore((s) => s.demo)
  const entries = useLiveStore((s) => (agent ? s.live[agent.id]?.log : undefined))
  const endRef = useRef<HTMLLIElement>(null)
  const count = entries?.length ?? 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [count, agent?.id])

  if (!agent) return null
  if (demo || !agent.active) {
    return (
      <div className="tab-panel empty-state">
        <p className="pixel-title">Tool log</p>
        <p>{demo ? 'Demo data. The log shows real tool calls once a crew member is on duty.' : `${agent.displayName} is off duty.`}</p>
      </div>
    )
  }

  return (
    <ul className="tab-panel list-panel log-list" aria-label={`${agent.displayName}'s log`}>
      {count === 0 ? <li className="muted">Nothing yet. Tool calls, approvals and finished turns appear here.</li> : null}
      {entries?.map((e) => (
        <li key={e.id} className={`log-row log-${e.kind}`}>
          <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString()}</time>
          <span className="log-kind">{KIND_LABEL[e.kind]}</span>
          <span className="log-text">{e.text}</span>
        </li>
      ))}
      <li ref={endRef} aria-hidden className="log-end" />
    </ul>
  )
}
