import { LogPanel } from './LogPanel'
import { TerminalPane } from './TerminalPane'
import {
  useActivityItems,
  useAgents,
  useAppStore,
  useBounties,
  useDenDen,
  useSelectedAgent
} from '@/store/app-store'

function Placeholder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tab-panel empty-state">
      <p className="pixel-title">{title}</p>
      <p>{children}</p>
    </div>
  )
}

function GraphView() {
  const agents = useAgents()
  const pack = useAppStore((s) => s.pack)
  const bounties = useBounties()
  const captain = agents.find((a) => a.id === pack?.captainId)
  const crew = agents.filter((a) => a.active && a.id !== captain?.id)
  if (!captain || !captain.active) {
    return <Placeholder title="Delegation graph">Put the captain on duty to see who they delegate to.</Placeholder>
  }
  const rowH = 44
  const h = Math.max(crew.length, 1) * rowH + 20
  return (
    <div className="tab-panel panel-inset graph-view">
      <svg width="100%" height={h} viewBox={`0 0 340 ${h}`} role="img" aria-label="Captain to crew delegation graph">
        <g>
          <rect x="8" y={h / 2 - 16} width="96" height="32" rx="4" fill={captain.signatureColor} stroke="#3d281c" strokeWidth="2" />
          <text x="56" y={h / 2 + 5} textAnchor="middle" fill="#fff" fontSize="12" fontFamily="inherit">{captain.displayName}</text>
        </g>
        {crew.map((a, i) => {
          const y = 10 + i * rowH + 16
          const count = bounties.filter((b) => b.assigneeId === a.id).length
          return (
            <g key={a.id}>
              <path d={`M104 ${h / 2} C 170 ${h / 2}, 150 ${y}, 216 ${y}`} fill="none" stroke="#5c3d2e" strokeWidth="2" />
              <rect x="216" y={y - 16} width="116" height="32" rx="4" fill={a.signatureColor} stroke="#3d281c" strokeWidth="2" />
              <text x="274" y={y + 5} textAnchor="middle" fill="#fff" fontSize="12" fontFamily="inherit">
                {a.displayName}{count ? ` · ${count}` : ''}
              </text>
            </g>
          )
        })}
      </svg>
      {crew.length === 0 ? <p className="muted">No crew on duty yet.</p> : null}
    </div>
  )
}

export function DeckTabContent() {
  const activeTab = useAppStore((s) => s.activeTab)
  const demo = useAppStore((s) => s.demo)
  const resolveDenDen = useAppStore((s) => s.resolveDenDen)
  const openSettings = useAppStore((s) => s.openSettings)
  const agents = useAgents()
  const selected = useSelectedAgent()
  const bounties = useBounties()
  const denDen = useDenDen()
  const activity = useActivityItems()
  const nameOf = (id: string | null) => agents.find((a) => a.id === id)?.displayName ?? 'Unassigned'

  switch (activeTab) {
    case 'terminal':
      return <TerminalPane />
    case 'log':
      return <LogPanel />
    case 'bounties':
      return (
        <div className="tab-panel bounty-board">
          {(['todo', 'in_progress', 'done'] as const).map((col) => (
            <div key={col} className="bounty-col panel-inset">
              <h4 className="pixel-title">{col.replace('_', ' ')}</h4>
              {bounties.filter((b) => b.column === col).length === 0 ? <p className="muted small">empty</p> : null}
              <ul>
                {bounties.filter((b) => b.column === col).map((b) => (
                  <li key={b.id}>
                    {b.title}
                    <small> · {nameOf(b.assigneeId)}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
    case 'denDenMushi':
      return (
        <ul className="tab-panel list-panel">
          {denDen.length === 0 ? (
            <li className="muted">No snails ringing. Permission requests from any agent will appear here.</li>
          ) : (
            denDen.map((r) => (
              <li key={r.id} className="den-item panel-inset">
                <div className="den-head">
                  <strong>{nameOf(r.agentId)}</strong>
                  <time className="muted small">{new Date(r.at).toLocaleTimeString()}</time>
                </div>
                <div className="den-summary">{r.summary}</div>
                {r.categoryLabel ? (
                  <p className="small muted den-reason">
                    {r.categoryLabel}. {r.reason}.
                  </p>
                ) : null}
                <code className="den-detail">{r.detail}</code>
                <div className="den-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void resolveDenDen(r.id, 'allow')}>allow</button>
                  <button type="button" className="btn" onClick={() => void resolveDenDen(r.id, 'deny')}>deny</button>
                </div>
              </li>
            ))
          )}
          {demo ? <li className="muted small">Demo request. Real requests appear here once crew are on duty.</li> : null}
          {!demo && denDen.length > 0 ? (
            <li className="muted small">You can also answer in the agent's terminal; the request then clears itself.</li>
          ) : null}
        </ul>
      )
    case 'triggers':
      return <Placeholder title="Triggers">Scheduled and recurring tasks arrive in Phase 10.</Placeholder>
    case 'memory':
      return <Placeholder title="Crew memory">Shared notes that persist across sessions, scoped to this crew. Arrives in Phase 10.</Placeholder>
    case 'graph':
      return <GraphView />
    case 'activity':
      return (
        <ul className="tab-panel list-panel">
          {activity.length === 0 ? <li className="muted">Nothing has happened yet. Open a voyage and put the crew on duty.</li> : null}
          {activity.map((a) => (
            <li key={a.id}>
              <time dateTime={a.at}>{new Date(a.at).toLocaleTimeString()}</time> · {a.message}
            </li>
          ))}
        </ul>
      )
    case 'skills':
      return selected ? (
        <div className="tab-panel">
          <p className="small muted">Current system prompt for {selected.displayName}. Reusable skills arrive in Phase 10.</p>
          <pre className="prompt-view panel-inset">{selected.systemPrompt}</pre>
          <button type="button" className="btn" onClick={() => openSettings('crew')}>edit in settings</button>
        </div>
      ) : null
    case 'temps':
      return <Placeholder title="Temp files">Scratch files produced by agents will be listed here (Phase 10).</Placeholder>
    default:
      return null
  }
}