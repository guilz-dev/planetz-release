import type { DatabaseSync } from 'node:sqlite'
import type { DecidedIntent } from '@planetz/shared'

interface DecidedIntentRow {
  thread_id: string
  version: number
  what: string
  why: string
  out_of_scope: string
  reason: string | null
  created_at: string
}

function parseOutOfScope(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    // fall through to empty list on malformed JSON
  }
  return []
}

function rowToRecord(row: DecidedIntentRow): DecidedIntent {
  return {
    id: `${row.thread_id}#v${row.version}`,
    threadId: row.thread_id,
    version: row.version,
    what: row.what,
    why: row.why,
    outOfScope: parseOutOfScope(row.out_of_scope),
    reason: row.reason,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS = 'thread_id, version, what, why, out_of_scope, reason, created_at'

export function getCurrentDecidedIntent(db: DatabaseSync, threadId: string): DecidedIntent | null {
  const row = db
    .prepare(
      `
        SELECT ${SELECT_COLUMNS}
        FROM decided_intent
        WHERE thread_id = ?
        ORDER BY version DESC
        LIMIT 1
      `,
    )
    .get(threadId) as unknown as DecidedIntentRow | undefined
  return row ? rowToRecord(row) : null
}

export function listDecidedIntentVersions(db: DatabaseSync, threadId: string): DecidedIntent[] {
  const rows = db
    .prepare(
      `
        SELECT ${SELECT_COLUMNS}
        FROM decided_intent
        WHERE thread_id = ?
        ORDER BY version DESC
      `,
    )
    .all(threadId) as unknown as DecidedIntentRow[]
  return rows.map(rowToRecord)
}

/** Append a new version for the thread (version = current max + 1). */
export function insertDecidedIntentVersion(
  db: DatabaseSync,
  input: {
    threadId: string
    what: string
    why: string
    outOfScope?: string[]
    reason?: string
    createdAt: string
  },
): DecidedIntent {
  const maxRow = db
    .prepare('SELECT MAX(version) AS max FROM decided_intent WHERE thread_id = ?')
    .get(input.threadId) as unknown as { max: number | null } | undefined
  const version = (maxRow?.max ?? 0) + 1
  db.prepare(
    `
      INSERT INTO decided_intent (
        thread_id, version, what, why, out_of_scope, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    input.threadId,
    version,
    input.what,
    input.why,
    JSON.stringify(input.outOfScope ?? []),
    input.reason ?? null,
    input.createdAt,
  )
  return {
    id: `${input.threadId}#v${version}`,
    threadId: input.threadId,
    version,
    what: input.what,
    why: input.why,
    outOfScope: input.outOfScope ?? [],
    reason: input.reason ?? null,
    createdAt: input.createdAt,
  }
}
