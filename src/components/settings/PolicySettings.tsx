import { useEffect, useState } from 'react'
import {
  CATEGORY_LABELS,
  DEFAULT_POLICY,
  POLICY_CATEGORY_ORDER,
  type AutoPolicy,
  type PolicyCategory,
  type PolicyDecision,
  type ShellGroup
} from '@shared/ipc'
import { useAppStore } from '@/store/app-store'

const GROUPS = new Set<string>(Object.keys(DEFAULT_POLICY.commandGroups))
const isGroup = (c: PolicyCategory): c is ShellGroup => GROUPS.has(c)

const toLines = (list: string[]) => list.join('\n')
const fromLines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

export function PolicySettings() {
  const saved = useAppStore((s) => s.prefs.policy)
  const autoMode = useAppStore((s) => s.prefs.autoMode)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const notify = useAppStore((s) => s.notify)

  const [draft, setDraft] = useState<AutoPolicy>(saved)
  const [hosts, setHosts] = useState(toLines(saved.networkAllowlist))
  const [lines, setLines] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraft(saved)
    setHosts(toLines(saved.networkAllowlist))
    setLines(Object.fromEntries(Object.entries(saved.commandGroups).map(([g, l]) => [g, toLines(l)])))
  }, [saved])

  const build = (): AutoPolicy => ({
    categories: draft.categories,
    commandGroups: Object.fromEntries(
      (Object.keys(DEFAULT_POLICY.commandGroups) as ShellGroup[]).map((g) => [g, fromLines(lines[g] ?? '')])
    ) as AutoPolicy['commandGroups'],
    networkAllowlist: fromLines(hosts)
  })

  const setDecision = (cat: PolicyCategory, decision: PolicyDecision) => {
    if (decision === 'auto' && CATEGORY_LABELS[cat].risky) {
      const ok = window.confirm(
        `"${CATEGORY_LABELS[cat].label}" is risky. With auto mode on, agents will do this without asking you.\n\nAllow it automatically?`
      )
      if (!ok) return
    }
    setDraft((d) => ({ ...d, categories: { ...d.categories, [cat]: decision } }))
  }

  const dirty = JSON.stringify(build()) !== JSON.stringify(saved)

  const save = async () => {
    await updatePrefs({ policy: build() })
    notify('info', 'Auto-approval policy saved.')
  }
  const reset = async () => {
    if (!window.confirm('Reset the auto-approval policy to the defaults?')) return
    await updatePrefs({ policy: DEFAULT_POLICY })
  }

  return (
    <div className="settings-pane">
      <h3 className="pixel-title">Auto-approval policy</h3>
      <p className="hint">
        Applies when <strong>auto mode is on</strong> (currently <strong>{autoMode ? 'on' : 'off'}</strong>). Anything set to
        “ask” goes to the Den Den Mushi queue. Commands that chain, redirect or substitute other commands, and paths outside
        an agent&apos;s own worktree, are always treated conservatively.
      </p>
      <ul className="policy-list">
        {POLICY_CATEGORY_ORDER.map((cat) => {
          const info = CATEGORY_LABELS[cat]
          return (
            <li key={cat} className="policy-row panel-inset">
              <div className="policy-head">
                <span>
                  {info.label} {info.risky ? <span className="risky-tag">risky</span> : null}
                </span>
                <select
                  value={draft.categories[cat]}
                  aria-label={`Decision for ${info.label}`}
                  onChange={(e) => setDecision(cat, e.target.value as PolicyDecision)}
                >
                  <option value="auto">auto-approve</option>
                  <option value="ask">ask me</option>
                </select>
              </div>
              {isGroup(cat) ? (
                <label className="field compact">
                  <span>
                    {cat === 'network' ? 'Commands treated as network access' : 'Command prefixes'} (one per line)
                  </span>
                  <textarea
                    rows={Math.min(Math.max((lines[cat] ?? '').split('\n').length, 2), 7)}
                    value={lines[cat] ?? ''}
                    spellCheck={false}
                    onChange={(e) => setLines((l) => ({ ...l, [cat]: e.target.value }))}
                  />
                </label>
              ) : null}
            </li>
          )
        })}
      </ul>
      <label className="field">
        <span>Network allowlist: hosts agents may reach without asking (one per line)</span>
        <textarea rows={4} value={hosts} spellCheck={false} onChange={(e) => setHosts(e.target.value)} />
      </label>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void save()}>Save policy</button>
        <button type="button" className="btn" onClick={() => void reset()}>Reset to defaults</button>
      </div>
    </div>
  )
}
