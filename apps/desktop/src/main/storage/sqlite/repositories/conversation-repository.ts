import type { DatabaseSync } from 'node:sqlite'
import type { ConversationEntry } from '@planetz/shared'

type ConversationRow = {
  id: string
  task_id: string
  role: string
  kind: string
  body: string
  created_at: string
}

function rowToEntry(row: ConversationRow): ConversationEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    role: row.role as ConversationEntry['role'],
    kind: row.kind as ConversationEntry['kind'],
    body: row.body,
    createdAt: row.created_at,
  }
}

export function listConversationsForTask(db: DatabaseSync, taskId: string): ConversationEntry[] {
  const rows = db
    .prepare(
      `
        SELECT id, task_id, role, kind, body, created_at
        FROM conversations
        WHERE task_id = ?
        ORDER BY created_at ASC, rowid ASC
      `,
    )
    .all(taskId) as ConversationRow[]
  return rows.map(rowToEntry)
}

export function insertConversation(db: DatabaseSync, entry: ConversationEntry): void {
  db.prepare(
    `
      INSERT INTO conversations (id, task_id, role, kind, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(entry.id, entry.taskId, entry.role, entry.kind, entry.body, entry.createdAt)
}
