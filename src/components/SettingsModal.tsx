import { useEffect } from 'react'
import { useAppStore, type SettingsTab } from '@/store/app-store'
import { CrewSettings } from './settings/CrewSettings'
import { KeySettings } from './settings/KeySettings'
import { PolicySettings } from './settings/PolicySettings'
import { SceneSettings } from './settings/SceneSettings'
import { VoyageSettings } from './settings/VoyageSettings'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'voyage', label: 'Voyage & editor' },
  { id: 'crew', label: 'Crew' },
  { id: 'policy', label: 'Auto-approval' },
  { id: 'keys', label: 'API keys' },
  { id: 'scene', label: 'Scene' }
]

export function SettingsModal() {
  const tab = useAppStore((s) => s.settingsTab)
  const open = useAppStore((s) => s.openSettings)
  const close = useAppStore((s) => s.closeSettings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div className="modal panel settings-modal" role="dialog" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="settings-title" className="pixel-title">Ship settings</h2>
          <button type="button" className="btn btn-icon" onClick={close} aria-label="Close settings">✕</button>
        </header>
        <div className="settings-body">
          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => open(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {tab === 'voyage' ? <VoyageSettings /> : null}
            {tab === 'crew' ? <CrewSettings /> : null}
            {tab === 'policy' ? <PolicySettings /> : null}
            {tab === 'keys' ? <KeySettings /> : null}
            {tab === 'scene' ? <SceneSettings /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
