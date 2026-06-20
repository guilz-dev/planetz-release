import type { DatabaseSync } from 'node:sqlite'
import type { RequirementIntentLink } from '@planetz/shared'

export interface RequirementIntentLinkRow {
  req_id: string
  thread_id: string
  decided_intent_version: number
  rationale: string
  source_task_id: string | null
  created_at: string
}

function rowToLink(row: RequirementIntentLinkRow): RequirementIntentLink {
  return {
    reqId: row.req_id,
    threadId: row.thread_id,
    decidedIntentVersion: row.decided_intent_version,
    rationale: row.rationale,
    sourceTaskId: row.source_task_id,
    createdAt: row.created_at,
  }
}

export function upsertRequirementIntentLink(
  db: DatabaseSync,
  input: {
    reqId: string
    threadId: string
    decidedIntentVersion: number
    rationale: string
    sourceTaskId?: string | null
    createdAt: string
  },
): void {
  db.prepare(
    `
      INSERT INTO requirement_intent_link (
        req_id, thread_id, decided_intent_version, rationale, source_task_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(req_id, thread_id) DO UPDATE SET
        decided_intent_version = excluded.decided_intent_version,
        rationale = excluded.rationale,
        source_task_id = excluded.source_task_id,
        created_at = excluded.created_at
    `,
  ).run(
    input.reqId,
    input.threadId,
    input.decidedIntentVersion,
    input.rationale,
    input.sourceTaskId ?? null,
    input.createdAt,
  )
}

export function listRequirementIntentLinksByThread(
  db: DatabaseSync,
  threadId: string,
): RequirementIntentLink[] {
  const rows = db
    .prepare(
      `
        SELECT req_id, thread_id, decided_intent_version, rationale, source_task_id, created_at
        FROM requirement_intent_link
        WHERE thread_id = ?
        ORDER BY req_id ASC
      `,
    )
    .all(threadId) as unknown as RequirementIntentLinkRow[]
  return rows.map(rowToLink)
}

export function countRequirementIntentLinksByThread(db: DatabaseSync, threadId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM requirement_intent_link WHERE thread_id = ?')
    .get(threadId) as unknown as { count: number }
  return row.count
}

export function countRequirementIntentLinksBySourceTaskId(
  db: DatabaseSync,
  sourceTaskId: string,
): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM requirement_intent_link WHERE source_task_id = ?')
    .get(sourceTaskId) as unknown as { count: number }
  return row.count
}
