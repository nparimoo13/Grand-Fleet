import type { DeckTab } from '@shared/ipc'
import { useAppStore, useDenDen } from '@/store/app-store'

const TABS: { id: DeckTab; label: string }[] = [
  { id: 'terminal', label: 'terminal' },
  { id: 'log', label: 'log' },
  { id: 'bounties', label: 'bounties' },
  { id: 'denDenMushi', label: 'den den mushi' },
  { id: 'triggers', label: 'triggers' },
  { id: 'memory', label: 'memory' },
  { id: 'graph', label: 'graph' },
  { id: 'activity', label: 'activity' },
  { id: 'skills', label: 'skills' },
  { id: 'temps', label: 'temps' }
]

export function DeckTabs() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setTab = useAppStore((s) => s.setTab)
  const waiting = useDenDen().length

  return (
    <div className="tab-grid" role="tablist" aria-label="Captain's Deck tabs">
      {TABS.map((tab) => {
        const ringing = tab.id === 'denDenMushi' && waiting > 0
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${ringing ? 'ringing' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {ringing ? <span aria-hidden>🐌 </span> : null}
            {tab.label}
            {ringing ? <span className="tab-badge" aria-label={`${waiting} waiting`}>{waiting}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
