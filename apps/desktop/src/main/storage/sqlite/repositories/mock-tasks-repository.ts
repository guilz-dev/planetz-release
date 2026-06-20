import type { DatabaseSync } from 'node:sqlite'
import type { TaskViewModel } from '@planetz/shared'

export type MockTaskRow = {
  id: string
  data_json: string
  status: string
  created_at: string
  updated_at: string
}

export function countMockTasks(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM mock_tasks').get() as { count?: number }
  return row.count ?? 0
}

export function listMockTaskRows(db: DatabaseSync): MockTaskRow[] {
  return db
    .prepare(
      `
        SELECT id, data_json, status, created_at, updated_at
        FROM mock_tasks
        ORDER BY created_at DESC, rowid DESC
      `,
    )
    .all() as MockTaskRow[]
}

export function replaceAllMockTasks(db: DatabaseSync, tasks: TaskViewModel[]): void {
  db.prepare('DELETE FROM mock_tasks').run()
  const insert = db.prepare(
    `
      INSERT INTO mock_tasks (id, data_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
  )
  for (const task of tasks) {
    insert.run(task.id, JSON.stringify(task), task.status, task.createdAt, task.updatedAt)
  }
}
