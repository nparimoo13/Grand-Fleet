import { useCallback, useEffect, useState } from 'react'
import { API_KEY_PROVIDER_IDS, type CliCheckResult, type CliProviderId, type ProviderId } from '@shared/ipc'
import { errorMessage, invoke } from '@/lib/api'
import { useAppStore } from '@/store/app-store'
import { ApiKeyEditor } from './settings/KeySettings'

function CommandBox({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard can be unavailable; the command is still selectable */
    }
  }
  return (
    <div className="cmd-box">
      <span className="cmd-label">{label}</span>
      <code className="cmd-text">{command}</code>
      <button type="button" className="btn" onClick={() => void copy()}>{copied ? 'copied' : 'copy'}</button>
    </div>
  )
}

function CliCard({
  result,
  skipped,
  onToggleSkip
}: {
  result: CliCheckResult
  skipped: boolean
  onToggleSkip: () => void
}) {
  const ready = result.found && result.loggedIn !== false
  const state = skipped ? 'skipped' : !result.found ? 'not installed' : result.loggedIn === false ? 'not logged in' : result.loggedIn === null ? 'installed' : 'ready'
  return (
    <div className={`cli-card panel-inset ${skipped ? 'skipped' : ''}`}>
      <div className="cli-head">
        <strong>{result.label}</strong>
        <span className={`cli-state ${ready && !skipped ? 'ok' : 'warn'}`}>{state}</span>
        <button type="button" className="btn btn-ghost" onClick={onToggleSkip}>{skipped ? 'use it' : 'skip'}</button>
      </div>
      {!skipped ? (
        <>
          {result.version ? <p className="small muted">{result.version}{result.resolvedPath ? ` · ${result.resolvedPath}` : ''}</p> : null}
          {!result.found ? <CommandBox label="install" command={result.installCommand} /> : null}
          {result.found && result.loggedIn === false ? <CommandBox label="log in" command={result.loginCommand} /> : null}
          {result.detail ? <p className="small muted">{result.detail}</p> : null}
        </>
      ) : null}
    </div>
  )
}

export function FirstRunWizard() {
  const prefs = useAppStore((s) => s.prefs)
  const updatePrefs = useAppStore((s) => s.updatePrefs)
  const notify = useAppStore((s) => s.notify)

  const [step, setStep] = useState(0)
  const [checks, setChecks] = useState<CliCheckResult[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [skipped, setSkipped] = useState<Set<ProviderId>>(new Set(prefs.skippedProviders))
  const [keys, setKeys] = useState<number>(0)

  const runChecks = useCallback(async () => {
    setChecking(true)
    try {
      setChecks(await invoke('providers:checkCli'))
    } catch (err) {
      notify('error', errorMessage(err))
    } finally {
      setChecking(false)
    }
  }, [notify])
  useEffect(() => {
    void runChecks()
  }, [runChecks])

  const toggleSkip = (id: CliProviderId) =>
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pickRoot = async () => {
    try {
      const next = await invoke('settings:pickVoyagesRoot')
      await updatePrefs({ voyagesRoot: next.voyagesRoot })
    } catch (err) {
      notify('error', errorMessage(err))
    }
  }

  const finish = async () => {
    const status = await invoke('settings:apiKeyStatus').catch(() => [])
    const apiSkipped = API_KEY_PROVIDER_IDS.filter((id) => !status.find((s) => s.provider === id)?.configured)
    await updatePrefs({ firstRunCompleted: true, skippedProviders: [...new Set([...skipped, ...apiSkipped])] })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal panel wizard" role="dialog" aria-labelledby="wizard-title">
        <header className="modal-header">
          <div>
            <h2 id="wizard-title" className="pixel-title">Welcome aboard</h2>
            <p className="small muted">Step {step + 1} of 3 · nothing is installed for you</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void updatePrefs({ firstRunCompleted: true })}>
            skip setup
          </button>
        </header>

        {step === 0 ? (
          <section>
            <h3 className="pixel-title">Command-line agents</h3>
            <p className="hint">
              Grand Fleet drives the Claude Code and Codex CLIs you already have. If one is missing, run the install command
              in your own terminal, then press Retry. You can skip any provider.
            </p>
            {checks === null ? <p className="muted">Checking your PATH…</p> : null}
            {checks?.map((r) => (
              <CliCard key={r.provider} result={r} skipped={skipped.has(r.provider)} onToggleSkip={() => toggleSkip(r.provider)} />
            ))}
            <div className="row">
              <button type="button" className="btn" disabled={checking} onClick={() => void runChecks()}>
                {checking ? 'Checking…' : 'Retry'}
              </button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <h3 className="pixel-title">API providers</h3>
            <p className="hint">The Anthropic and OpenAI API providers only need a key, stored encrypted by your OS. Ollama needs no key. Leave blank to skip.</p>
            <ApiKeyEditor key={keys} />
            <button type="button" className="btn btn-ghost" onClick={() => setKeys((k) => k + 1)}>refresh</button>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h3 className="pixel-title">Where do new voyages live?</h3>
            <p className="hint">Optional. New projects are created as folders inside this parent folder. You can also open any existing project later.</p>
            <div className="row">
              <input type="text" readOnly value={prefs.voyagesRoot} placeholder="Not set (you can set this later in Settings)" />
              <button type="button" className="btn" onClick={() => void pickRoot()}>Choose…</button>
            </div>
          </section>
        ) : null}

        <footer className="wizard-footer">
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>back</button>
          {step < 2 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>next</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void finish()}>set sail</button>
          )}
        </footer>
      </div>
    </div>
  )
}
