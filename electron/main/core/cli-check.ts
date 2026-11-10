import type { CliCheckResult, CliProviderId } from '../../../shared/types/providers'
import { resolveOnPath, runFile } from './exec'

interface CliSpec {
  provider: CliProviderId
  label: string
  binary: string
  versionArgs: string[]
  /** Login-status command. Exit code 0 (or JSON loggedIn=true) means logged in. */
  authArgs: string[]
  install: Record<'win32' | 'darwin' | 'linux', string>
  login: string
}

const SPECS: CliSpec[] = [
  {
    provider: 'claude-code-cli',
    label: 'Claude Code',
    binary: 'claude',
    versionArgs: ['--version'],
    authArgs: ['auth', 'status'],
    install: {
      win32: 'npm install -g @anthropic-ai/claude-code',
      darwin: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code'
    },
    login: 'claude auth login'
  },
  {
    provider: 'codex-cli',
    label: 'OpenAI Codex',
    binary: 'codex',
    versionArgs: ['--version'],
    authArgs: ['login', 'status'],
    install: {
      win32: 'npm install -g @openai/codex',
      darwin: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex'
    },
    login: 'codex login'
  }
]

function installFor(spec: CliSpec): string {
  const p = process.platform
  return spec.install[p === 'win32' || p === 'darwin' ? p : 'linux']
}

function parseLoggedIn(code: number | null, stdout: string): boolean | null {
  const trimmed = stdout.trim()
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { loggedIn?: unknown }
      if (typeof json.loggedIn === 'boolean') return json.loggedIn
    } catch {
      /* fall through to exit code */
    }
  }
  if (code === 0) return true
  if (code === 1) return false
  return null
}

export async function checkCli(spec: CliSpec): Promise<CliCheckResult> {
  const base = {
    provider: spec.provider,
    label: spec.label,
    installCommand: installFor(spec),
    loginCommand: spec.login
  }
  const resolved = resolveOnPath(spec.binary)
  if (!resolved) {
    return { ...base, found: false, resolvedPath: null, version: null, loggedIn: null, detail: `\`${spec.binary}\` was not found on PATH.` }
  }
  const version = await runFile(resolved, spec.versionArgs, { timeoutMs: 15_000, soft: true })
  const versionText = version.code === 0 ? (version.stdout.trim().split(/\r?\n/)[0] ?? null) : null
  if (version.code !== 0) {
    return {
      ...base,
      found: true,
      resolvedPath: resolved,
      version: null,
      loggedIn: null,
      detail: `\`${spec.binary} ${spec.versionArgs.join(' ')}\` failed: ${(version.stderr || 'no output').trim().slice(0, 200)}`
    }
  }
  const auth = await runFile(resolved, spec.authArgs, { timeoutMs: 20_000, soft: true })
  const loggedIn = auth.timedOut ? null : parseLoggedIn(auth.code, auth.stdout)
  return {
    ...base,
    found: true,
    resolvedPath: resolved,
    version: versionText,
    loggedIn,
    detail: loggedIn === null ? 'Could not determine login state; you can still continue.' : null
  }
}

export function checkAllClis(): Promise<CliCheckResult[]> {
  return Promise.all(SPECS.map(checkCli))
}
