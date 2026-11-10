import { useEffect } from 'react'
import { useAgents, useAppStore } from '@/store/app-store'
import { Portrait, StatusPill, providerLabel } from './common'

export function AgentInfoModal() {
  const id = useAppStore((s) => s.infoAgentId)
  const showInfo = useAppStore((s) => s.showInfo)
  const openSettings = useAppStore((s) => s.openSettings)
  const voyage = useAppStore((s) => s.voyage)
  const pack = useAppStore((s) => s.pack)
  const agents = useAgents()
  const agent = agents.find((a) => a.id === id)
  const room = pack?.ship.rooms.find((r) => r.id === agent?.defaultRoomId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && showInfo(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showInfo])

  if (!agent) return null
  const worktree = voyage && agent.active ? `${voyage.path}/.grandfleet/worktrees/${agent.id}` : null

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => showInfo(null)}>
      <div className="modal panel small-modal" role="dialog" aria-label={`${agent.displayName} details`} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="info-head">
            <Portrait agent={agent} />
            <div>
              <h2 className="pixel-title">{agent.displayName}</h2>
              <span className="role-badge">{agent.roleBadge}</span> <StatusPill status={agent.runtime.status} />
            </div>
          </div>
          <button type="button" className="btn btn-icon" onClick={() => showInfo(null)} aria-label="Close">✕</button>
        </header>
        <dl className="info-list">
          <dt>Role</dt><dd>{agent.role}</dd>
          <dt>Station</dt><dd>{room?.label ?? agent.defaultRoomId}</dd>
          <dt>Provider</dt><dd>{providerLabel(agent.provider)} · {agent.model}</dd>
          <dt>Working folder</dt><dd>{worktree ?? (agent.active ? '—' : 'None while off duty')}</dd>
          <dt>Status</dt><dd>{agent.runtime.statusLine}</dd>
        </dl>
        <p className="muted small">“{agent.flavorLines[0] ?? ''}”</p>
        <button type="button" className="btn" onClick={() => { showInfo(null); openSettings('crew') }}>
          edit role, model and prompt
        </button>
      </div>
    </div>
  )
}
