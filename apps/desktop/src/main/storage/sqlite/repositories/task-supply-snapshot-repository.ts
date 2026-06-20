import type { DatabaseSync } from 'node:sqlite'

export interface TaskSupplySnapshotRow {
  task_id: string
  entry_ids_json: string
  captured_at: string
  match_basis: string
}

export interface TaskSupplySnapshotRecord {
  taskId: string
  entryIds: string[]
  capturedAt: string
  matchBasis: string
}

function parseEntryIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

/** Persist the supply entry ids captured at run dispatch. */
export function upsertTaskSupplySnapshot(
  db: DatabaseSync,
  input: {
    taskId: string
    entryIds: readonly string[]
    capturedAt: string
    matchBasis: string
  },
): void {
  db.prepare(
    `
      INSERT INTO task_supply_snapshot (task_id, entry_ids_json, captured_at, match_basis)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        entry_ids_json = excluded.entry_ids_json,
        captured_at = excluded.captured_at,
        match_basis = excluded.match_basis
    `,
  ).run(input.taskId, JSON.stringify([...input.entryIds]), input.capturedAt, input.matchBasis)
}

export function getTaskSupplySnapshot(
  db: DatabaseSync,
  taskId: string,
): TaskSupplySnapshotRecord | null {
  const row = db
    .prepare(
      `
        SELECT task_id, entry_ids_json, captured_at, match_basis
        FROM task_supply_snapshot
        WHERE task_id = ?
      `,
    )
    .get(taskId) as TaskSupplySnapshotRow | undefined
  if (!row) return null
  return {
    taskId: row.task_id,
    entryIds: parseEntryIds(row.entry_ids_json),
    capturedAt: row.captured_at,
    matchBasis: row.match_basis,
  }
}

export function listTaskSupplySnapshots(
  db: DatabaseSync,
  taskIds: readonly string[],
): TaskSupplySnapshotRecord[] {
  if (taskIds.length === 0) return []
  const placeholders = taskIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `
        SELECT task_id, entry_ids_json, captured_at, match_basis
        FROM task_supply_snapshot
        WHERE task_id IN (${placeholders})
      `,
    )
    .all(...taskIds) as unknown as TaskSupplySnapshotRow[]
  return rows.map((row) => ({
    taskId: row.task_id,
    entryIds: parseEntryIds(row.entry_ids_json),
    capturedAt: row.captured_at,
    matchBasis: row.match_basis,
  }))
}
