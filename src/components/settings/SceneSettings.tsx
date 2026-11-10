import { useState } from 'react'
import type { AmbientFrequency, SceneTime, SceneWeather } from '@shared/ipc'
import { ArtPreview } from '@/components/ArtPreview'
import { useAppStore } from '@/store/app-store'

export function SceneSettings() {
  const [artOpen, setArtOpen] = useState(false)
  const prefs = useAppStore((s) => s.prefs)
  const updatePrefs = useAppStore((s) => s.updatePrefs)

  return (
    <div className="settings-pane">
      <h3 className="pixel-title">Ship scene</h3>
      <label className="field">
        <span>Time of day</span>
        <select value={prefs.sceneTime} onChange={(e) => void updatePrefs({ sceneTime: e.target.value as SceneTime })}>
          <option value="auto">Follow my clock</option>
          <option value="day">Always day</option>
          <option value="night">Always night</option>
        </select>
      </label>
      <label className="field">
        <span>Weather (cosmetic)</span>
        <select value={prefs.sceneWeather} onChange={(e) => void updatePrefs({ sceneWeather: e.target.value as SceneWeather })}>
          <option value="clear">Clear</option>
          <option value="rain">Light rain</option>
          <option value="fog">Fog</option>
        </select>
      </label>
      <label className="field">
        <span>Ambient life</span>
        <select value={prefs.ambientFrequency} onChange={(e) => void updatePrefs({ ambientFrequency: e.target.value as AmbientFrequency })}>
          <option value="off">Off</option>
          <option value="chill">Chill</option>
          <option value="lively">Lively</option>
        </select>
      </label>
      <label className="field check">
        <input type="checkbox" checked={prefs.quietMode} onChange={(e) => void updatePrefs({ quietMode: e.target.checked })} />
        Quiet mode (no speech bubbles)
      </label>
      <h3 className="pixel-title">Developer</h3>
      <label className="field check">
        <input type="checkbox" checked={prefs.demoData} onChange={(e) => void updatePrefs({ demoData: e.target.checked })} />
        Show demo data while no voyage is open
      </label>
      <button type="button" className="btn" onClick={() => setArtOpen(true)}>
        Open art preview
      </button>
      <p className="small muted">Shows every ship sheet at 2–3× on light and dark backgrounds. Regenerate with <code>pnpm art</code>.</p>
      {artOpen ? <ArtPreview onClose={() => setArtOpen(false)} /> : null}
    </div>
  )
}
