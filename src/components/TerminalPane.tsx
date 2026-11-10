import { useEffect, useRef } from 'react'
import { attachTerminal, setTerminalFontSize } from '@/terminal/registry'
import { useAppStore, useSelectedAgent } from '@/store/app-store'

/** The selected agent's live terminal (xterm.js bound to the agent's pseudo-terminal). */
export function TerminalPane() {
  const agent = useSelectedAgent()
  const voyage = useAppStore((s) => s.voyage)
  const demo = useAppStore((s) => s.demo)
  const fontSize = useAppStore((s) => s.prefs.terminalFontSize)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const restartAgent = useAppStore((s) => s.restartAgent)
  const hostRef = useRef<HTMLDivElement>(null)

  const agentId = agent?.id
  const live = !!agent && agent.active && !!voyage

  useEffect(() => {
    setTerminalFontSize(fontSize)
  }, [fontSize])

  useEffect(() => {
    const container = hostRef.current
    if (!container || !agentId || !live) return
    return attachTerminal(agentId, container)
  }, [agentId, live])

  const bump = (delta: number) => void updatePrefs({ terminalFontSize: Math.min(24, Math.max(9, fontSize + delta)) })

  if (!agent) return null

  return (
    <div className="tab-panel terminal-pane panel-inset">
      <div className="terminal-toolbar">
        <span className="terminal-title">
          {agent.displayName} · {agent.provider}
        </span>
        <span className="terminal-spacer" />
        <span>font {fontSize}</span>
        <button type="button" className="btn btn-icon" aria-label="Decrease font size" disabled={fontSize <= 9} onClick={() => bump(-1)}>
          −
        </button>
        <button type="button" className="btn btn-icon" aria-label="Increase font size" disabled={fontSize >= 24} onClick={() => bump(1)}>
          +
        </button>
      </div>

      {live && agent.runtime.error ? (
        <div className="terminal-banner" role="alert">
          <span>{agent.runtime.error}</span>
          <button type="button" className="btn" onClick={() => void restartAgent(agent.id)}>
            retry
          </button>
        </div>
      ) : null}

      {live ? (
        <div className="terminal-mount" ref={hostRef} />
      ) : (
        <div className="terminal-empty">
          {demo
            ? 'Demo data. Open or create a voyage and put a crew member on duty to see a live terminal.'
            : !voyage
              ? 'Open a voyage to begin.'
              : `${agent.displayName} is off duty. Put them on duty to start a session.`}
        </div>
      )}
    </div>
  )
}
