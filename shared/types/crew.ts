/**
 * Crew pack schema. Everything crew-specific (names, roles, rooms, prompts,
 * ambient behaviours) lives in `assets/crews/<crewId>/` and is loaded through
 * these types. The engine and UI must never hardcode a crew member name.
 */

import type { ShipArtManifest } from './art'

export interface CrewIndexEntry {
  id: string
  name: string
  shipName: string
  available: boolean
  comingSoon?: boolean
}

export interface CrewIndex {
  crews: CrewIndexEntry[]
}

export interface AmbientBehavior {
  id: string
  anim: string
  durationSec: [number, number]
  room?: string
  weight: number
  bubble?: string[]
}

/** Contents of `characters/<id>/character.json`. */
export interface CharacterDef {
  id: string
  displayName: string
  role: string
  roleBadge: string
  /** Signature colour, used as a placeholder portrait until art lands. */
  signatureColor: string
  defaultRoomId: string
  defaultProvider: ProviderIdLike
  defaultModel: string
  systemPrompt: string
  flavorLines: string[]
  ambient: AmbientBehavior[]
}

/** Kept as a plain string here so crew packs can't break on new providers. */
export type ProviderIdLike = string

export interface RoomDef {
  id: string
  label: string
  /** 0 = top deck, increasing downward. */
  deck: number
  /** Only exists in the pixel ship (src/ship/room-defs.ts): the legacy tile-grid views skip it. */
  pixelOnly?: boolean
  /** Rectangle in 16px tile units. */
  rect: { x: number; y: number; w: number; h: number }
  /** Where an agent works, in tile units inside the room. */
  station: { x: number; y: number; facing: 'left' | 'right' }
  props: string[]
}

export interface PathDef {
  from: string
  to: string
  kind: 'stairs' | 'ladder' | 'deck' | 'door'
}

/** Contents of `ship/ship.json`. */
export interface ShipDef {
  id: string
  name: string
  tileSize: number
  size: { w: number; h: number }
  rooms: RoomDef[]
  paths: PathDef[]
}

/** Contents of `crew.json` (character ids only; details live in character.json). */
export interface CrewManifest {
  id: string
  name: string
  tagline: string
  /** The orchestrating "boss" character. */
  captainId: string
  ship: string
  characters: string[]
}

/** Fully resolved crew pack as served to the renderer. */
export interface CrewPack {
  id: string
  name: string
  tagline: string
  captainId: string
  ship: ShipDef
  /** Present when `pnpm art` has been run for this crew. */
  shipArt: ShipArtManifest | null
  /** Character ids that ship a drop-in sprite sheet (`characters/<id>/override/<id>.png` + `<id>.json`). */
  spriteOverrides: string[]
  characters: CharacterDef[]
}
