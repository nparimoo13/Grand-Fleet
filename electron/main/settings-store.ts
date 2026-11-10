import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_PREFERENCES, type AppPreferences } from '../../shared/types/app'
import {
  API_KEY_PROVIDER_IDS,
  type ApiKeyProviderId,
  type ApiKeyStatus
} from '../../shared/types/providers'
import { mergePreferences, parseStoredPreferences } from './core/preferences'

function settingsDir(): string {
  const dir = path.join(app.getPath('userData'), 'settings')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Write atomically so a crash can't leave a half-written file. */
function writeAtomic(file: string, data: string | Buffer): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, data, { mode: 0o600 })
  renameSync(tmp, file)
}

let cache: AppPreferences | null = null

export function loadPreferences(): AppPreferences {
  if (cache) return cache
  const file = path.join(settingsDir(), 'preferences.json')
  cache = existsSync(file) ? parseStoredPreferences(readFileSync(file, 'utf8')) : structuredClone(DEFAULT_PREFERENCES)
  return cache
}

export function savePreferences(patch: unknown): AppPreferences {
  cache = mergePreferences(loadPreferences(), patch)
  writeAtomic(path.join(settingsDir(), 'preferences.json'), JSON.stringify(cache, null, 2))
  return cache
}

/**
 * True only when the OS gives us real encryption. On Linux, Electron can fall
 * back to a "basic_text" backend that is not protected; we refuse to use that.
 */
export function encryptionAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  if (process.platform === 'linux') {
    const backend = (safeStorage as unknown as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend?.()
    if (backend === 'basic_text' || backend === 'unknown') return false
  }
  return true
}

function keyFile(provider: ApiKeyProviderId): string {
  return path.join(settingsDir(), `api-key-${provider}.bin`)
}

export function setApiKey(provider: ApiKeyProviderId, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) return clearApiKey(provider)
  if (!encryptionAvailable()) {
    throw new Error('OS secure storage is unavailable, so API keys cannot be saved on this system.')
  }
  writeAtomic(keyFile(provider), safeStorage.encryptString(trimmed))
}

export function clearApiKey(provider: ApiKeyProviderId): void {
  const file = keyFile(provider)
  if (existsSync(file)) unlinkSync(file)
}

/** Main-process only. Never expose the return value over IPC. */
export function getApiKey(provider: ApiKeyProviderId): string | null {
  const file = keyFile(provider)
  if (!existsSync(file) || !encryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(file))
  } catch {
    return null
  }
}

export function apiKeyStatuses(): ApiKeyStatus[] {
  return API_KEY_PROVIDER_IDS.map((provider) => {
    const key = getApiKey(provider)
    return { provider, configured: key !== null, hint: key && key.length >= 8 ? key.slice(-4) : null }
  })
}
