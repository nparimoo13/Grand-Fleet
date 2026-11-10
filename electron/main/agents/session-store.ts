import { getDb } from '../db'
import type { SessionStore } from './manager'

/** SQLite-backed session records. agent_sessions rows carry crew_id (sessions are crew-scoped). */
export const sqliteSessionStore: SessionStore = {
  begin(row) {
    getDb()
      .prepare(
        `INSERT INTO agent_sessions (id, crew_id, voyage_id, agent_id, provider, model, started_at, status, external_id, confirmed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)`
      )
      .run(
        row.id,
        row.crewId,
        row.voyageId,
        row.agentId,
        row.provider,
        row.model,
        new Date().toISOString(),
        row.externalId,
        row.externalId ? 1 : 0
      )
  },

  setExternal(id, externalId, confirmed) {
    // Same id: only ever upgrade to confirmed. A new id (fresh session) starts unconfirmed.
    getDb()
      .prepare(
        `UPDATE agent_sessions
            SET confirmed = CASE WHEN external_id IS ? THEN MAX(confirmed, ?) ELSE ? END,
                external_id = ?
          WHERE id = ?`
      )
      .run(externalId, confirmed ? 1 : 0, confirmed ? 1 : 0, externalId, id)
  },

  lastResumable(voyageId, agentId) {
    const row = getDb()
      .prepare(
        `SELECT external_id FROM agent_sessions
          WHERE voyage_id = ? AND agent_id = ? AND confirmed = 1 AND external_id IS NOT NULL
          ORDER BY started_at DESC LIMIT 1`
      )
      .get(voyageId, agentId) as { external_id: string } | undefined
    return row?.external_id ?? null
  },

  updateCost(id, costUsd) {
    getDb().prepare('UPDATE agent_sessions SET cost_usd = ? WHERE id = ?').run(costUsd, id)
  },

  end(id, status) {
    getDb().prepare('UPDATE agent_sessions SET ended_at = ?, status = ? WHERE id = ?').run(new Date().toISOString(), status, id)
  }
}
