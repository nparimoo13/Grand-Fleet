import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ActivityRecord, Voyage } from '../../shared/types/app'
import { getDb } from './db'

interface VoyageRow {
  id: string
  crew_id: string
  name: string
  path: string
  created_at: string
  last_opened_at: string
}

const toVoyage = (r: VoyageRow): Voyage => ({
  id: r.id,
  crewId: r.crew_id,
  name: r.name,
  path: r.path,
  createdAt: r.created_at,
  lastOpenedAt: r.last_opened_at
})

export function listVoyages(crewId: string, limit = 20): Voyage[] {
  return (
    getDb()
      .prepare('SELECT * FROM voyages WHERE crew_id = ? ORDER BY last_opened_at DESC LIMIT ?')
      .all(crewId, limit) as VoyageRow[]
  ).map(toVoyage)
}

export function getVoyage(id: string): Voyage {
  const row = getDb().prepare('SELECT * FROM voyages WHERE id = ?').get(id) as VoyageRow | undefined
  if (!row) throw new Error('That voyage no longer exists.')
  return toVoyage(row)
}

/** Insert or reuse the voyage for this crew + folder, and mark it opened now. */
export function upsertVoyage(crewId: string, dir: string): Voyage {
  const resolved = path.resolve(dir)
  const now = new Date().toISOString()
  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM voyages WHERE crew_id = ? AND path = ?')
    .get(crewId, resolved) as VoyageRow | undefined
  if (existing) {
    db.prepare('UPDATE voyages SET last_opened_at = ? WHERE id = ?').run(now, existing.id)
    return toVoyage({ ...existing, last_opened_at: now })
  }
  const row: VoyageRow = {
    id: randomUUID(),
    crew_id: crewId,
    name: path.basename(resolved) || resolved,
    path: resolved,
    created_at: now,
    last_opened_at: now
  }
  db.prepare(
    'INSERT INTO voyages (id, crew_id, name, path, created_at, last_opened_at) VALUES (@id, @crew_id, @name, @path, @created_at, @last_opened_at)'
  ).run(row)
  return toVoyage(row)
}

export function touchVoyage(id: string): Voyage {
  const voyage = getVoyage(id)
  if (!existsSync(voyage.path) || !statSync(voyage.path).isDirectory()) {
    throw new Error(`The folder for "${voyage.name}" no longer exists: ${voyage.path}`)
  }
  getDb().prepare('UPDATE voyages SET last_opened_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  return getVoyage(id)
}

/** Forget a voyage. Never touches files on disk. */
export function forgetVoyage(id: string): void {
  getDb().prepare('DELETE FROM voyages WHERE id = ?').run(id)
}

const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export function validateVoyageName(name: string): string {
  const n = name.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(n) || /[. ]$/.test(n) || RESERVED_WINDOWS.test(n)) {
    throw new Error('Use 1-64 letters, numbers, spaces, dots, dashes or underscores, starting with a letter or number.')
  }
  return n
}

/** Create the folder for a new voyage under the voyages root. */
export function newVoyageFolder(voyagesRoot: string, name: string): string {
  if (!voyagesRoot) throw new Error('Set a voyages folder in Settings before creating a new voyage.')
  const clean = validateVoyageName(name)
  const dir = path.join(voyagesRoot, clean)
  if (existsSync(dir)) throw new Error(`A folder named "${clean}" already exists in ${voyagesRoot}.`)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function logActivity(entry: {
  crewId: string
  voyageId?: string | null
  agentId?: string | null
  kind: string
  message: string
}): void {
  getDb()
    .prepare('INSERT INTO activity (crew_id, voyage_id, agent_id, at, kind, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(entry.crewId, entry.voyageId ?? null, entry.agentId ?? null, new Date().toISOString(), entry.kind, entry.message)
}

export function listActivity(crewId: string, limit = 100): ActivityRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM activity WHERE crew_id = ? ORDER BY id DESC LIMIT ?')
    .all(crewId, Math.min(Math.max(limit, 1), 500)) as Array<{
    id: number
    crew_id: string
    voyage_id: string | null
    agent_id: string | null
    at: string
    kind: string
    message: string
  }>
  return rows.map((r) => ({
    id: r.id,
    crewId: r.crew_id,
    voyageId: r.voyage_id,
    agentId: r.agent_id,
    at: r.at,
    kind: r.kind,
    message: r.message
  }))
}
