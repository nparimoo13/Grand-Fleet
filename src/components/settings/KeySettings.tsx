import { useCallback, useEffect, useState } from 'react'
import { PROVIDERS, type ApiKeyProviderId, type ApiKeyStatus } from '@shared/ipc'
import { errorMessage, invoke } from '@/lib/api'
import { useAppStore } from '@/store/app-store'

/** Reusable by the settings screen and the first-run wizard. */
export function ApiKeyEditor() {
  const notify = useAppStore((s) => s.notify)
  const [status, setStatus] = useState<ApiKeyStatus[]>([])
  const [encryption, setEncryption] = useState(true)
  const [drafts, setDrafts] = useState<Partial<Record<ApiKeyProviderId, string>>>({})

  const refresh = useCallback(async () => {
    const [s, enc] = await Promise.all([invoke('settings:apiKeyStatus'), invoke('settings:encryptionAvailable')])
    setStatus(s)
    setEncryption(enc)
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const label = (id: string) => PROVIDERS.find((p) => p.id === id)?.label ?? id

  const save = async (provider: ApiKeyProviderId) => {
    try {
      setStatus(await invoke('settings:setApiKey', { provider, key: drafts[provider] ?? '' }))
      setDrafts((d) => ({ ...d, [provider]: '' }))
      notify('info', `${label(provider)} key saved (encrypted).`)
    } catch (err) {
      notify('error', errorMessage(err))
    }
  }
  const clear = async (provider: ApiKeyProviderId) => {
    try {
      setStatus(await invoke('settings:clearApiKey', { provider }))
    } catch (err) {
      notify('error', errorMessage(err))
    }
  }

  return (
    <div>
      {!encryption ? (
        <p className="warning">OS secure storage is unavailable, so keys cannot be saved on this system.</p>
      ) : null}
      {status.map((s) => (
        <div key={s.provider} className="key-row panel-inset">
          <div className="key-head">
            <strong>{label(s.provider)}</strong>
            <span className={s.configured ? 'ok' : 'muted'}>{s.configured ? `saved${s.hint ? ` ···${s.hint}` : ''}` : 'not set'}</span>
          </div>
          <div className="row">
            <input
              type="password"
              autoComplete="off"
              placeholder={s.configured ? 'Paste a new key to replace' : 'Paste API key'}
              value={drafts[s.provider] ?? ''}
              disabled={!encryption}
              onChange={(e) => setDrafts((d) => ({ ...d, [s.provider]: e.target.value }))}
            />
            <button type="button" className="btn" disabled={!encryption || !drafts[s.provider]?.trim()} onClick={() => void save(s.provider)}>Save</button>
            {s.configured ? <button type="button" className="btn btn-ghost" onClick={() => void clear(s.provider)}>Remove</button> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function KeySettings() {
  const ollama = useAppStore((s) => s.prefs.ollamaBaseUrl)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const [url, setUrl] = useState(ollama)
  useEffect(() => setUrl(ollama), [ollama])

  return (
    <div className="settings-pane">
      <h3 className="pixel-title">API keys</h3>
      <p className="hint">Encrypted with the operating system&apos;s secure storage. The renderer never sees a stored key. The CLI providers use their own login.</p>
      <ApiKeyEditor />
      <h3 className="pixel-title">Ollama</h3>
      <label className="field">
        <span>Server URL (no key needed)</span>
        <div className="row">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="btn" disabled={url === ollama} onClick={() => void updatePrefs({ ollamaBaseUrl: url })}>Save</button>
        </div>
      </label>
    </div>
  )
}
