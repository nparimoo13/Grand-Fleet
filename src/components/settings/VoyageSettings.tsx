import { useEffect, useState } from 'react'
import { invoke, errorMessage } from '@/lib/api'
import { useAppStore } from '@/store/app-store'

export function VoyageSettings() {
  const prefs = useAppStore((s) => s.prefs)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const notify = useAppStore((s) => s.notify)
  const [custom, setCustom] = useState(prefs.editor.custom)

  useEffect(() => setCustom(prefs.editor.custom), [prefs.editor.custom])

  const pickRoot = async () => {
    try {
      const next = await invoke('settings:pickVoyagesRoot')
      await updatePrefs({ voyagesRoot: next.voyagesRoot })
    } catch (err) {
      notify('error', errorMessage(err))
    }
  }

  return (
    <div className="settings-pane">
      <h3 className="pixel-title">Voyages</h3>
      <p className="hint">
        Each voyage is a project. Every crew member on duty works in their own git worktree of it, under
        <code> .grandfleet/worktrees/&lt;id&gt;</code>. Off-duty crew get no folder.
      </p>
      <label className="field">
        <span>Folder for new voyages</span>
        <div className="row">
          <input type="text" readOnly value={prefs.voyagesRoot} placeholder="Not set" />
          <button type="button" className="btn" onClick={() => void pickRoot()}>Choose…</button>
          {prefs.voyagesRoot ? <button type="button" className="btn btn-ghost" onClick={() => void updatePrefs({ voyagesRoot: '' })}>Clear</button> : null}
        </div>
      </label>

      <h3 className="pixel-title">Editor (IDE button)</h3>
      <label className="field">
        <span>Preferred editor</span>
        <select
          value={prefs.editor.preferred}
          onChange={(e) => void updatePrefs({ editor: { preferred: e.target.value as 'cursor' | 'code' | 'custom', custom } })}
        >
          <option value="cursor">Cursor (falls back to VS Code)</option>
          <option value="code">VS Code (falls back to Cursor)</option>
          <option value="custom">Custom command</option>
        </select>
      </label>
      {prefs.editor.preferred === 'custom' ? (
        <label className="field">
          <span>Custom command (the folder is appended as the last argument)</span>
          <div className="row">
            <input type="text" value={custom} placeholder="zed   or   C:\Tools\editor.exe --new-window" onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="btn" onClick={() => void updatePrefs({ editor: { preferred: 'custom', custom } })}>Save</button>
          </div>
        </label>
      ) : null}

      <h3 className="pixel-title">Setup</h3>
      <div className="row">
        <button type="button" className="btn" onClick={() => void updatePrefs({ firstRunCompleted: false })}>
          Run setup wizard again
        </button>
      </div>
    </div>
  )
}
