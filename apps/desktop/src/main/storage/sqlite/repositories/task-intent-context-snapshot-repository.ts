import type { DatabaseSync } from 'node:sqlite'

export interface TaskIntentContextSnapshotRow {
  task_id: string
  thread_id: string
  decided_intent_version: number
  captured_at: string
}

export interface TaskIntentContextSnapshot {
  taskId: string
  threadId: string
  decidedIntentVersion: number
  capturedAt: string
}

function rowToSnapshot(row: TaskIntentContextSnapshotRow): TaskIntentContextSnapshot {
  return {
    taskId: row.task_id,
    threadId: row.thread_id,
    decidedIntentVersion: row.decided_intent_version,
    capturedAt: row.captured_at,
  }
}

export function upsertTaskIntentContextSnapshot(
  db: DatabaseSync,
  input: TaskIntentContextSnapshot,
): void {
  db.prepare(
    `
      INSERT INTO task_intent_context_snapshot (
        task_id, thread_id, decided_intent_version, captured_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        thread_id = excluded.thread_id,
        decided_intent_version = excluded.decided_intent_version,
        captured_at = excluded.captured_at
    `,
  ).run(input.taskId, input.threadId, input.decidedIntentVersion, input.capturedAt)
}

export function getTaskIntentContextSnapshot(
  db: DatabaseSync,
  taskId: string,
): TaskIntentContextSnapshot | null {
  const row = db
    .prepare(
      `
        SELECT task_id, thread_id, decided_intent_version, captured_at
        FROM task_intent_context_snapshot
        WHERE task_id = ?
      `,
    )
    .get(taskId) as unknown as TaskIntentContextSnapshotRow | undefined
  return row ? rowToSnapshot(row) : null
}
