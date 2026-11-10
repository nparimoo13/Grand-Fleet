import { DEFAULT_POLICY, type AutoPolicy } from './policy'
import type { ProviderId } from './providers'

export type AmbientFrequency = 'off' | 'chill' | 'lively'
export type SceneTime = 'auto' | 'day' | 'night'
/** Cosmetic weather over the ship scene. */
export type SceneWeather = 'clear' | 'rain' | 'fog'
export type EditorChoice = 'cursor' | 'code' | 'custom'

/** User edits to a character's defaults. Absent keys fall back to character.json. */
export interface CharacterOverride {
  role?: string
  provider?: ProviderId
  model?: string
  systemPrompt?: string
}

export interface AppPreferences {
  firstRunCompleted: boolean
  /** Providers the user chose to skip in the first-run wizard. */
  skippedProviders: ProviderId[]
  autoMode: boolean
  activeCrewId: string
  activeVoyageId: string | null
  /** Parent folder for newly created voyages. Empty = not set yet. */
  voyagesRoot: string
  ambientFrequency: AmbientFrequency
  quietMode: boolean
  sceneTime: SceneTime
  sceneWeather: SceneWeather
  editor: { preferred: EditorChoice; custom: string }
  ollamaBaseUrl: string
  /** Terminal font size in px (9-24). */
  terminalFontSize: number
  policy: AutoPolicy
  /** crewId -> characterId -> override. */
  characterOverrides: Record<string, Record<string, CharacterOverride>>
  /** Show fixture data when no voyage is open. */
  demoData: boolean
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  firstRunCompleted: false,
  skippedProviders: [],
  autoMode: false,
  activeCrewId: 'strawhats',
  activeVoyageId: null,
  voyagesRoot: '',
  ambientFrequency: 'chill',
  quietMode: false,
  sceneTime: 'auto',
  sceneWeather: 'clear',
  editor: { preferred: 'cursor', custom: '' },
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  terminalFontSize: 13,
  policy: DEFAULT_POLICY,
  characterOverrides: {},
  demoData: true
}

export interface Voyage {
  id: string
  crewId: string
  name: string
  /** Absolute path of the main repo checkout. */
  path: string
  createdAt: string
  lastOpenedAt: string
}

export interface ActivityRecord {
  id: number
  crewId: string
  voyageId: string | null
  agentId: string | null
  at: string
  kind: string
  message: string
}

export interface ActivationResult {
  agentId: string
  active: boolean
  worktreePath: string | null
  /** Set when deactivation kept the worktree (uncommitted changes). */
  warning: string | null
}

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'off_duty'

export type DeckTab =
  | 'terminal'
  | 'log'
  | 'bounties'
  | 'denDenMushi'
  | 'triggers'
  | 'memory'
  | 'graph'
  | 'activity'
  | 'skills'
  | 'temps'
