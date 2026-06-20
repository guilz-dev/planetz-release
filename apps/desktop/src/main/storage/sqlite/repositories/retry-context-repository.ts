import type { DatabaseSync } from 'node:sqlite'
import type { retryContextSchema } from '@planetz/shared'
import type { z } from 'zod'

type RetryContextRecord = z.infer<typeof retryContextSchema>

type RetryContextRow = {
  task_id: string
  origin_task_id: string
  kind: string
  prompt: string | null
  branch: string | null
  created_at: string
}

function rowToRecord(row: RetryContextRow): RetryContextRecord {
  return {
    taskId: row.task_id,
    originTaskId: row.origin_task_id,
    kind: row.kind as RetryContextRecord['kind'],
    prompt: row.prompt ?? undefined,
    branch: row.branch ?? undefined,
    createdAt: row.created_at,
  }
}

export function listRetryContexts(db: DatabaseSync): RetryContextRecord[] {
  const rows = db
    .prepare(
      `
        SELECT task_id, origin_task_id, kind, prompt, branch, created_at
        FROM retry_contexts
        ORDER BY created_at ASC, rowid ASC
      `,
    )
    .all() as RetryContextRow[]
  return rows.map(rowToRecord)
}

export function insertRetryContext(db: DatabaseSync, record: RetryContextRecord): void {
  db.prepare(
    `
      INSERT INTO retry_contexts (task_id, origin_task_id, kind, prompt, branch, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(
    record.taskId,
    record.originTaskId,
    record.kind,
    record.prompt ?? null,
    record.branch ?? null,
    record.createdAt,
  )
}
