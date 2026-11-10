import { useEffect, useRef, useState } from 'react'
import { formatUptime, useNow } from '@/lib/time'
import { useAgents, useAppStore, type Agent } from '@/store/app-store'
import { Portrait, StatusPill, providerLabel } from './common'

function formatCost(usd: number): string {
  return usd >= 0.1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(3)}`
}

function RecruitMenu({ offDuty }: { offDuty: Agent[] }) {
  const toggleAgent = useAppStore((s) => s.toggleAgent)
  const select = useAppStore((s) => s.select)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="recruit" ref={ref}>
      <button
        type="button"
        className="recruit-slot btn"
        disabled={offDuty.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={offDuty.length === 0 ? 'The whole crew is on duty' : 'Put an off-duty crew member to work'}
      >
        + recruit crew
      </button>
      {open ? (
        <div className="menu-pop menu-up" role="menu">
          {offDuty.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false)
                select(a.id)
                void toggleAgent(a.id, true)
              }}
            >
              <strong>{a.displayName}</strong>
              <small>{a.role}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CrewRoster() {
  const agents = useAgents()
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)
  const showInfo = useAppStore((s) => s.showInfo)
  const toggleAgent = useAppStore((s) => s.toggleAgent)
  const now = useNow()

  return (
    <footer className="crew-roster rope-edge" aria-label="Crew roster">
      <div className="roster-scroll">
        {agents.map((a) => (
          <article key={a.id} className={`wanted-card ${a.id === selectedId ? 'selected' : ''} ${a.active ? '' : 'inactive'}`}>
            <button type="button" className="card-hit" onClick={() => select(a.id)} aria-pressed={a.id === selectedId}>
              <Portrait agent={a} />
              <div className="card-body">
                <div className="card-title-row">
                  <span className="pixel-title card-name">{a.displayName}</span>
                  <span className="role-badge">{a.roleBadge}</span>
                </div>
                <StatusPill status={a.runtime.status} />
                <dl className="card-stats">
                  <div>
                    <dt>model</dt>
                    <dd title={`${a.provider} · ${a.model}`}>{providerLabel(a.provider)} · {a.model}</dd>
                  </div>
                  <div>
                    <dt>context</dt>
                    <dd title={a.runtime.contextTokens ? `${a.runtime.contextTokens.toLocaleString()} tokens in context` : undefined}>
                      {a.active && a.runtime.contextPercent !== null ? `${a.runtime.contextPercent}%` : '—'}
                      {a.active && a.runtime.costUsd !== null ? ` · ${formatCost(a.runtime.costUsd)}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>uptime</dt>
                    <dd>{a.active ? formatUptime(a.runtime.startedAt, now) : '—'}</dd>
                  </div>
                </dl>
              </div>
            </button>
            <div className="card-footer">
              <button type="button" className="btn" onClick={() => { select(a.id); document.querySelector<HTMLTextAreaElement>('.queue-input')?.focus() }}>
                talk
              </button>
              <button type="button" className="btn" onClick={() => void toggleAgent(a.id)} title={a.active ? 'Stand down (removes the worktree if it has no uncommitted changes)' : 'Report for duty (creates a git worktree)'}>
                {a.active ? 'stand down' : 'on duty'}
              </button>
              <button type="button" className="btn btn-ghost" aria-label={`Info about ${a.displayName}`} onClick={() => showInfo(a.id)}>
                i
              </button>
            </div>
          </article>
        ))}
        <RecruitMenu offDuty={agents.filter((a) => !a.active)} />
      </div>
    </footer>
  )
}
