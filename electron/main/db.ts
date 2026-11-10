import { app } from 'electron'
import Database from 'better-sqlite3'
import path from 'node:path'

/**
 * Persistence. Per the workspace decisions:
 *  - voyages, tasks and the activity log are global but every row has crew_id
 *  - agent sessions and memory are scoped to a crew (crew_id on every row)
 * Switching crews filters views; nothing is deleted.
 */
const MIGRATIONS: string[] = [
  /* v1 */ `
  CREATE TABLE voyages (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_opened_at TEXT NOT NULL,
    UNIQUE (crew_id, path)
  );
  CREATE INDEX idx_voyages_recent ON voyages (crew_id, last_opened_at DESC);

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    voyage_id TEXT REFERENCES voyages (id) ON DELETE CASCADE,
    parent_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    acceptance TEXT NOT NULL DEFAULT '',
    assignee_id TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_tasks_voyage ON tasks (crew_id, voyage_id, status);

  CREATE TABLE task_deps (
    crew_id TEXT NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    depends_on TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on)
  );

  CREATE TABLE activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crew_id TEXT NOT NULL,
    voyage_id TEXT REFERENCES voyages (id) ON DELETE SET NULL,
    agent_id TEXT,
    at TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL
  );
  CREATE INDEX idx_activity_recent ON activity (crew_id, at DESC);

  CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    voyage_id TEXT REFERENCES voyages (id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'idle'
  );

  CREATE TABLE memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crew_id TEXT NOT NULL,
    author_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_memory_crew ON memory (crew_id, created_at DESC);
  `,
  /* v2: provider-side session identity (for resume) and cost tracking */ `
  ALTER TABLE agent_sessions ADD COLUMN external_id TEXT;
  ALTER TABLE agent_sessions ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE agent_sessions ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0;
  CREATE INDEX idx_sessions_agent ON agent_sessions (voyage_id, agent_id, started_at DESC);
  `
]

let db: Database.Database | null = null

export function migrate(database: Database.Database): void {
  const current = database.pragma('user_version', { simple: true }) as number
  for (let v = current; v < MIGRATIONS.length; v++) {
    database.transaction(() => {
      database.exec(MIGRATIONS[v])
      database.pragma(`user_version = ${v + 1}`)
    })()
  }
}

export function getDb(): Database.Database {
  if (db) return db
  db = new Database(path.join(app.getPath('userData'), 'grandfleet.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
