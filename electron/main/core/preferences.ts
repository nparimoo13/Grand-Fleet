import {
  DEFAULT_PREFERENCES,
  type AppPreferences,
  type CharacterOverride
} from '../../../shared/types/app'
import {
  DEFAULT_POLICY,
  POLICY_CATEGORY_ORDER,
  type AutoPolicy,
  type PolicyDecision,
  type ShellGroup
} from '../../../shared/types/policy'
import { isProviderId } from '../../../shared/types/providers'

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/i
const SHELL_GROUPS = Object.keys(DEFAULT_POLICY.commandGroups) as ShellGroup[]

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length <= max ? v : undefined
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined

function stringList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(v) || v.length > maxItems) return undefined
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') return undefined
    const t = item.trim()
    if (t && t.length <= maxLen) out.push(t)
  }
  return [...new Set(out)]
}

export function mergePolicy(current: AutoPolicy, patch: unknown): AutoPolicy {
  if (!isObj(patch)) return current
  const next: AutoPolicy = {
    categories: { ...current.categories },
    commandGroups: { ...current.commandGroups },
    networkAllowlist: [...current.networkAllowlist]
  }
  if (isObj(patch.categories)) {
    for (const cat of POLICY_CATEGORY_ORDER) {
      const d = oneOf<PolicyDecision>(patch.categories[cat], ['auto', 'ask'])
      if (d) next.categories[cat] = d
    }
  }
  if (isObj(patch.commandGroups)) {
    for (const g of SHELL_GROUPS) {
      const list = stringList(patch.commandGroups[g], 200, 120)
      if (list) next.commandGroups[g] = list
    }
  }
  const hosts = stringList(patch.networkAllowlist, 100, 253)
  if (hosts) next.networkAllowlist = hosts.map((h) => h.toLowerCase())
  return next
}

function mergeOverrides(
  current: AppPreferences['characterOverrides'],
  patch: unknown
): AppPreferences['characterOverrides'] {
  if (!isObj(patch)) return current
  const out: AppPreferences['characterOverrides'] = {}
  for (const [crewId, chars] of Object.entries(patch)) {
    if (!SAFE_ID.test(crewId) || !isObj(chars)) continue
    out[crewId] = {}
    for (const [charId, raw] of Object.entries(chars)) {
      if (!SAFE_ID.test(charId) || !isObj(raw)) continue
      const o: CharacterOverride = {}
      const role = str(raw.role, 80)
      const model = str(raw.model, 120)
      const prompt = str(raw.systemPrompt, 20_000)
      if (role !== undefined) o.role = role
      if (model !== undefined) o.model = model
      if (prompt !== undefined) o.systemPrompt = prompt
      if (isProviderId(raw.provider)) o.provider = raw.provider
      out[crewId][charId] = o
    }
  }
  return out
}

function validUrl(v: unknown): string | undefined {
  const s = str(v, 300)
  if (!s) return undefined
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s.replace(/\/+$/, '') : undefined
  } catch {
    return undefined
  }
}

/** Merge an untrusted patch into preferences, keeping only well-typed fields. */
export function mergePreferences(current: AppPreferences, patch: unknown): AppPreferences {
  if (!isObj(patch)) return current
  const next: AppPreferences = { ...current }
  const set = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K] | undefined): void => {
    if (value !== undefined) next[key] = value
  }
  set('firstRunCompleted', bool(patch.firstRunCompleted))
  set('autoMode', bool(patch.autoMode))
  set('quietMode', bool(patch.quietMode))
  set('demoData', bool(patch.demoData))
  set('ambientFrequency', oneOf(patch.ambientFrequency, ['off', 'chill', 'lively'] as const))
  set('sceneTime', oneOf(patch.sceneTime, ['auto', 'day', 'night'] as const))
  set('sceneWeather', oneOf(patch.sceneWeather, ['clear', 'rain', 'fog'] as const))
  set('voyagesRoot', str(patch.voyagesRoot, 500))
  set('ollamaBaseUrl', validUrl(patch.ollamaBaseUrl))
  if (typeof patch.terminalFontSize === 'number' && Number.isFinite(patch.terminalFontSize)) {
    next.terminalFontSize = Math.min(24, Math.max(9, Math.round(patch.terminalFontSize)))
  }
  if (typeof patch.activeCrewId === 'string' && SAFE_ID.test(patch.activeCrewId)) next.activeCrewId = patch.activeCrewId
  if (patch.activeVoyageId === null) next.activeVoyageId = null
  else if (typeof patch.activeVoyageId === 'string' && patch.activeVoyageId.length <= 80) next.activeVoyageId = patch.activeVoyageId
  if (Array.isArray(patch.skippedProviders)) {
    next.skippedProviders = [...new Set(patch.skippedProviders.filter(isProviderId))]
  }
  if (isObj(patch.editor)) {
    next.editor = {
      preferred: oneOf(patch.editor.preferred, ['cursor', 'code', 'custom'] as const) ?? current.editor.preferred,
      custom: str(patch.editor.custom, 500) ?? current.editor.custom
    }
  }
  if (patch.policy !== undefined) next.policy = mergePolicy(current.policy, patch.policy)
  if (patch.characterOverrides !== undefined) {
    next.characterOverrides = mergeOverrides(current.characterOverrides, patch.characterOverrides)
  }
  return next
}

export function parseStoredPreferences(raw: string): AppPreferences {
  try {
    return mergePreferences(structuredClone(DEFAULT_PREFERENCES), JSON.parse(raw))
  } catch {
    return structuredClone(DEFAULT_PREFERENCES)
  }
}
