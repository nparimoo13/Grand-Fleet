import { invoke } from '@/lib/api'
import { resolveIsNight, useNow } from '@/lib/time'
import { useAppStore } from '@/store/app-store'
import { VoyageMenu } from './VoyageMenu'

export function TopBar() {
  const version = useAppStore((s) => s.version)
  const pack = useAppStore((s) => s.pack)
  const crewIndex = useAppStore((s) => s.crewIndex)
  const prefs = useAppStore((s) => s.prefs)
  const demo = useAppStore((s) => s.demo)
  const switchCrew = useAppStore((s) => s.switchCrew)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const openSettings = useAppStore((s) => s.openSettings)
  useNow()

  const night = resolveIsNight(prefs.sceneTime)

  return (
    <header className="top-bar rope-edge">
      <div className="top-left">
        <span className="app-mark pixel-title" aria-hidden>⚓</span>
        <div>
          <h1 className="app-name pixel-title">Grand Fleet</h1>
          <p className="app-sub">
            v{version || '…'}
            {demo ? <span className="demo-tag" title="No voyage is open, so fixture data is shown.">demo data</span> : null}
          </p>
        </div>
      </div>

      <div className="top-center">
        <label className="ship-select-wrap">
          <span className="sr-only">Crew and ship</span>
          <select
            className="ship-select"
            value={pack?.id ?? ''}
            onChange={(e) => void switchCrew(e.target.value)}
            aria-label="Ship selector"
          >
            {crewIndex.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.available}>
                {c.name} · {c.id === pack?.id ? pack.ship.name : c.shipName}
                {c.comingSoon ? ' (coming soon)' : ''}
              </option>
            ))}
          </select>
        </label>
        <VoyageMenu />
      </div>

      <div className="top-right">
        <button
          type="button"
          className={`mode-chip ${prefs.autoMode ? 'on' : ''}`}
          onClick={() => void updatePrefs({ autoMode: !prefs.autoMode })}
          title="Auto mode approves safe actions per your policy (Settings → Auto-approval)"
        >
          auto mode {prefs.autoMode ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          title={night ? 'Switch scene to day' : 'Switch scene to night'}
          onClick={() => void updatePrefs({ sceneTime: night ? 'day' : 'night' })}
        >
          {night ? '☾' : '☀'}
        </button>
        <button type="button" className="btn btn-icon" title="Settings" onClick={() => openSettings()}>
          ⚙
        </button>
        <button type="button" className="btn btn-icon" title="Fullscreen" onClick={() => void invoke('window:toggleFullscreen')}>
          ⛶
        </button>
      </div>
    </header>
  )
}
