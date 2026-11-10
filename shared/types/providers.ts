export type ProviderId =
  | 'claude-code-cli'
  | 'codex-cli'
  | 'anthropic-api'
  | 'openai-api'
  | 'ollama'

export type ProviderKind = 'cli' | 'api-key' | 'local'

export interface ProviderInfo {
  id: ProviderId
  label: string
  kind: ProviderKind
}

export const PROVIDERS: readonly ProviderInfo[] = [
  { id: 'claude-code-cli', label: 'Claude Code CLI', kind: 'cli' },
  { id: 'codex-cli', label: 'OpenAI Codex CLI', kind: 'cli' },
  { id: 'anthropic-api', label: 'Anthropic API', kind: 'api-key' },
  { id: 'openai-api', label: 'OpenAI API', kind: 'api-key' },
  { id: 'ollama', label: 'Ollama (local)', kind: 'local' }
] as const

export const PROVIDER_IDS: readonly ProviderId[] = PROVIDERS.map((p) => p.id)

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

/** Providers that authenticate with a stored API key. */
export type ApiKeyProviderId = 'anthropic-api' | 'openai-api'
export const API_KEY_PROVIDER_IDS: readonly ApiKeyProviderId[] = ['anthropic-api', 'openai-api']

export function isApiKeyProviderId(value: unknown): value is ApiKeyProviderId {
  return typeof value === 'string' && (API_KEY_PROVIDER_IDS as readonly string[]).includes(value)
}

export type CliProviderId = 'claude-code-cli' | 'codex-cli'
export const CLI_PROVIDER_IDS: readonly CliProviderId[] = ['claude-code-cli', 'codex-cli']

export interface ApiKeyStatus {
  provider: ApiKeyProviderId
  configured: boolean
  /** Last 4 characters only. The full key never leaves the main process. */
  hint: string | null
}

export interface CliCheckResult {
  provider: CliProviderId
  label: string
  found: boolean
  resolvedPath: string | null
  version: string | null
  /** null = could not be determined. */
  loggedIn: boolean | null
  installCommand: string
  loginCommand: string
  detail: string | null
}
