import { stubSpeechToText } from '@/lib/speech'
import { useAppStore, useSelectedAgent } from '@/store/app-store'
import { DeckTabContent } from './DeckTabContent'
import { DeckTabs } from './DeckTabs'
import { Portrait, StatusPill } from './common'

export function CaptainsDeck() {
  const agent = useSelectedAgent()
  const voyage = useAppStore((s) => s.voyage)
  const queueDraft = useAppStore((s) => s.queueDraft)
  const setQueueDraft = useAppStore((s) => s.setQueueDraft)
  const sendDraft = useAppStore((s) => s.sendDraft)
  const openInIde = useAppStore((s) => s.openInIde)
  const autoMode = useAppStore((s) => s.prefs.autoMode)
  const updatePrefs = useAppStore((s) => s.updatePrefs)

  if (!agent) return <aside className="captains-deck panel" aria-label="Captain's Deck" />

  return (
    <aside className="captains-deck panel" aria-label="Captain's Deck">
      <header className="deck-header">
        <Portrait agent={agent} />
        <div className="deck-meta">
          <h2 className="pixel-title">{agent.displayName}</h2>
          <StatusPill status={agent.runtime.status} />
          <p className="deck-status-line">{agent.runtime.statusLine}</p>
        </div>
        <div className="deck-actions">
          <label className="auto-toggle" title="Global auto mode: approve safe actions per your policy">
            <input type="checkbox" checked={autoMode} onChange={(e) => void updatePrefs({ autoMode: e.target.checked })} />
            auto
          </label>
          <button
            type="button"
            className="btn"
            disabled={!voyage}
            title={
              !voyage
                ? 'Open a voyage first'
                : agent.active
                  ? `Open ${agent.displayName}'s worktree in your editor`
                  : 'Off duty: opens the voyage folder instead'
            }
            onClick={() => void openInIde(agent.active ? agent.id : null)}
          >
            IDE
          </button>
        </div>
      </header>

      <DeckTabs />
      <div className="deck-content">
        <DeckTabContent />
      </div>

      <footer className="deck-queue">
        <textarea
          className="queue-input"
          rows={3}
          placeholder={
            !voyage
              ? 'Open a voyage to message the crew'
              : agent.active
                ? `Message ${agent.displayName}. Enter sends, Shift+Enter adds a line.`
                : `${agent.displayName} is off duty. Put them on duty to send messages.`
          }
          value={queueDraft}
          onChange={(e) => setQueueDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void sendDraft()
            }
          }}
        />
        <div className="queue-actions">
          <button
            type="button"
            className="btn"
            disabled={!stubSpeechToText.available}
            title="Voice input arrives in the polish phase"
          >
            voice
          </button>
          <button type="button" className="btn" disabled title="Attachments arrive with the agent engine">+ files</button>
          <button type="button" className="btn" disabled title="Attachments arrive with the agent engine">+ folder</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!voyage || !agent.active || !agent.runtime.running || !queueDraft.trim()}
            title={agent.active && !agent.runtime.running ? 'The session is not running. Use retry in the terminal tab.' : 'Send to the agent (Enter)'}
            onClick={() => void sendDraft()}
          >
            send
          </button>
        </div>
      </footer>
    </aside>
  )
}
