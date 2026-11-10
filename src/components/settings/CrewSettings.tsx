import { useEffect, useMemo, useState } from 'react'
import { PROVIDERS, type CharacterOverride, type ProviderId } from '@shared/ipc'
import { useAppStore } from '@/store/app-store'

interface Draft {
  role: string
  provider: string
  model: string
  systemPrompt: string
}

export function CrewSettings() {
  const pack = useAppStore((s) => s.pack)
  const prefs = useAppStore((s) => s.prefs)
  const selectedId = useAppStore((s) => s.selectedId)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const notify = useAppStore((s) => s.notify)

  const [charId, setCharId] = useState(selectedId)
  const def = pack?.characters.find((c) => c.id === charId) ?? pack?.characters[0]
  const saved = def ? prefs.characterOverrides[pack!.id]?.[def.id] : undefined

  const base: Draft | null = useMemo(
    () =>
      def
        ? {
            role: saved?.role ?? def.role,
            provider: saved?.provider ?? def.defaultProvider,
            model: saved?.model ?? def.defaultModel,
            systemPrompt: saved?.systemPrompt ?? def.systemPrompt
          }
        : null,
    [def, saved]
  )
  const [draft, setDraft] = useState<Draft | null>(base)
  useEffect(() => setDraft(base), [base])

  if (!pack || !def || !draft || !base) return null
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)

  const writeOverride = async (override: CharacterOverride | null) => {
    const forCrew = { ...(prefs.characterOverrides[pack.id] ?? {}) }
    if (override && Object.keys(override).length > 0) forCrew[def.id] = override
    else delete forCrew[def.id]
    // The server merges per crew, so send the full per-crew map (replace semantics for this crew).
    await updatePrefs({ characterOverrides: { ...prefs.characterOverrides, [pack.id]: forCrew } })
  }

  const save = async () => {
    if (!draft.role.trim() || !draft.model.trim() || !draft.systemPrompt.trim()) {
      notify('error', 'Role, model and system prompt cannot be empty.')
      return
    }
    const o: CharacterOverride = {}
    if (draft.role !== def.role) o.role = draft.role.trim()
    if (draft.provider !== def.defaultProvider) o.provider = draft.provider as ProviderId
    if (draft.model !== def.defaultModel) o.model = draft.model.trim()
    if (draft.systemPrompt !== def.systemPrompt) o.systemPrompt = draft.systemPrompt
    await writeOverride(o)
    notify('info', `${def.displayName} updated.`)
  }

  const reset = async () => {
    await writeOverride(null)
    notify('info', `${def.displayName} reset to the crew defaults.`)
  }

  return (
    <div className="settings-pane">
      <h3 className="pixel-title">Crew member</h3>
      <p className="hint">Roles, providers and prompts start from the crew pack. Your edits are stored separately and can be reset.</p>
      <label className="field">
        <span>Character</span>
        <select value={def.id} onChange={(e) => setCharId(e.target.value)}>
          {pack.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName} · {prefs.characterOverrides[pack.id]?.[c.id]?.role ?? c.role}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Role</span>
        <input type="text" value={draft.role} maxLength={80} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
      </label>
      <div className="row two">
        <label className="field">
          <span>Provider</span>
          <select value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input type="text" value={draft.model} maxLength={120} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
        </label>
      </div>
      <p className="hint">“default” lets the provider choose its own default model.</p>
      <label className="field">
        <span>System prompt</span>
        <textarea rows={9} value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} />
      </label>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void save()}>Save {def.displayName}</button>
        <button type="button" className="btn" disabled={!saved} onClick={() => void reset()}>Reset to default</button>
      </div>
    </div>
  )
}
