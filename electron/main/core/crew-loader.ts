import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ShipArtManifest } from '../../../shared/types/art'
import type {
  CharacterDef,
  CrewIndex,
  CrewIndexEntry,
  CrewManifest,
  CrewPack,
  ShipDef
} from '../../../shared/types/crew'

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/i

export class CrewPackError extends Error {}

function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new CrewPackError(`Missing file: ${file}`)
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (err) {
    throw new CrewPackError(`Invalid JSON in ${file}: ${(err as Error).message}`)
  }
}

function assertString(value: unknown, what: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new CrewPackError(`${what} must be a non-empty string`)
}

export function loadCrewIndex(assetsRoot: string): CrewIndexEntry[] {
  const index = readJson<CrewIndex>(path.join(assetsRoot, 'crews', 'index.json'))
  if (!Array.isArray(index.crews)) throw new CrewPackError('crews/index.json must contain a "crews" array')
  return index.crews.map((c) => {
    assertString(c.id, 'crew id')
    if (!SAFE_ID.test(c.id)) throw new CrewPackError(`Unsafe crew id: ${c.id}`)
    assertString(c.name, `name of crew ${c.id}`)
    return {
      id: c.id,
      name: c.name,
      shipName: typeof c.shipName === 'string' ? c.shipName : '',
      available: c.available === true,
      comingSoon: c.comingSoon === true
    }
  })
}

function validateShip(ship: ShipDef, crewId: string): void {
  assertString(ship.name, `ship name in ${crewId}`)
  const ids = new Set<string>()
  for (const room of ship.rooms) {
    assertString(room.id, 'room id')
    if (ids.has(room.id)) throw new CrewPackError(`Duplicate room id "${room.id}" in ${crewId}`)
    ids.add(room.id)
  }
  for (const p of ship.paths) {
    if (!ids.has(p.from) || !ids.has(p.to)) {
      throw new CrewPackError(`Path ${p.from} -> ${p.to} in ${crewId} references an unknown room`)
    }
  }
}

function validateCharacter(c: CharacterDef, folderId: string, rooms: Set<string>): void {
  if (c.id !== folderId) throw new CrewPackError(`character.json id "${c.id}" does not match folder "${folderId}"`)
  for (const key of ['displayName', 'role', 'roleBadge', 'signatureColor', 'defaultRoomId', 'systemPrompt'] as const) {
    assertString(c[key], `${key} of ${c.id}`)
  }
  if (!rooms.has(c.defaultRoomId)) throw new CrewPackError(`${c.id}: unknown defaultRoomId "${c.defaultRoomId}"`)
  for (const a of c.ambient ?? []) {
    if (a.room && !rooms.has(a.room)) throw new CrewPackError(`${c.id}: ambient "${a.id}" uses unknown room "${a.room}"`)
  }
}

/** Load a full crew pack. Everything crew-specific comes from this folder. */
export function loadCrewPack(assetsRoot: string, crewId: string): CrewPack {
  if (!SAFE_ID.test(crewId)) throw new CrewPackError(`Unsafe crew id: ${crewId}`)
  const entry = loadCrewIndex(assetsRoot).find((c) => c.id === crewId)
  if (!entry) throw new CrewPackError(`Unknown crew: ${crewId}`)
  if (!entry.available) throw new CrewPackError(`${entry.name} is coming soon`)

  const dir = path.join(assetsRoot, 'crews', crewId)
  const manifest = readJson<CrewManifest>(path.join(dir, 'crew.json'))
  if (manifest.id !== crewId) throw new CrewPackError(`crew.json id "${manifest.id}" does not match folder "${crewId}"`)

  const shipFile = path.resolve(dir, manifest.ship)
  if (path.relative(dir, shipFile).startsWith('..')) throw new CrewPackError('Ship path escapes the crew folder')
  const ship = readJson<ShipDef>(shipFile)
  validateShip(ship, crewId)
  const rooms = new Set(ship.rooms.map((r) => r.id))

  const seen = new Set<string>()
  const characters = manifest.characters.map((id) => {
    if (!SAFE_ID.test(id)) throw new CrewPackError(`Unsafe character id: ${id}`)
    if (seen.has(id)) throw new CrewPackError(`Duplicate character id: ${id}`)
    seen.add(id)
    const c = readJson<CharacterDef>(path.join(dir, 'characters', id, 'character.json'))
    validateCharacter(c, id, rooms)
    return { ...c, flavorLines: c.flavorLines ?? [], ambient: c.ambient ?? [] }
  })
  if (!seen.has(manifest.captainId)) throw new CrewPackError(`captainId "${manifest.captainId}" is not in the crew`)

  const artFile = path.join(dir, 'ship', 'art.json')
  const shipArt = existsSync(artFile) ? readJson<ShipArtManifest>(artFile) : null

  return {
    id: manifest.id,
    name: manifest.name,
    tagline: manifest.tagline ?? '',
    captainId: manifest.captainId,
    ship,
    shipArt,
    spriteOverrides: characters
      .map((c) => c.id)
      .filter((id) => {
        const base = path.join(dir, 'characters', id, 'override', id)
        return existsSync(`${base}.png`) && existsSync(`${base}.json`)
      }),
    characters
  }
}
