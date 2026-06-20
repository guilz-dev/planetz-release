import type { DatabaseSync } from 'node:sqlite'

export interface TaskThreadLinkRow {
  task_id: string
  thread_id: string
  created_at: string
}

/** Persist the originating conversation thread for an enqueued task. */
export function upsertTaskThreadLink(
  db: DatabaseSync,
  input: { taskId: string; threadId: string; createdAt: string },
): void {
  db.prepare(
    `
      INSERT INTO task_thread_link (task_id, thread_id, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        thread_id = excluded.thread_id,
        created_at = excluded.created_at
    `,
  ).run(input.taskId, input.threadId, input.createdAt)
}

/** Task ids spawned from a conversation thread, oldest first. */
export function listTaskIdsByThread(db: DatabaseSync, threadId: string): string[] {
  const rows = db
    .prepare(
      `
        SELECT task_id
        FROM task_thread_link
        WHERE thread_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(threadId) as unknown as Array<{ task_id: string }>
  return rows.map((row) => row.task_id)
}

/** Originating thread for an enqueued task, if linked. */
export function getThreadIdByTaskId(db: DatabaseSync, taskId: string): string | null {
  const row = db
    .prepare(
      `
        SELECT thread_id
        FROM task_thread_link
        WHERE task_id = ?
      `,
    )
    .get(taskId) as unknown as { thread_id: string } | undefined
  return row?.thread_id ?? null
}
