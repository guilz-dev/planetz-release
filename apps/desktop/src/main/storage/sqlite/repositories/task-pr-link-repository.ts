import type { DatabaseSync } from 'node:sqlite'
import type { TaskPrSummary } from '@planetz/shared'

export interface TaskPrLinkRow {
  task_id: string
  branch: string
  repo: string
  number: number
  url: string
  state: 'open' | 'closed' | 'merged'
  is_draft: number
  base_branch: string
  updated_at: string
}

export interface TaskPrLinkRecord {
  taskId: string
  branch: string
  repo: string
  number: number
  url: string
  state: 'open' | 'closed' | 'merged'
  isDraft: boolean
  baseBranch: string
  updatedAt: string
}

function rowToRecord(row: TaskPrLinkRow): TaskPrLinkRecord {
  return {
    taskId: row.task_id,
    branch: row.branch,
    repo: row.repo,
    number: row.number,
    url: row.url,
    state: row.state,
    isDraft: row.is_draft !== 0,
    baseBranch: row.base_branch,
    updatedAt: row.updated_at,
  }
}

export function listTaskPrLinks(db: DatabaseSync): TaskPrLinkRecord[] {
  const rows = db
    .prepare(
      `
        SELECT task_id, branch, repo, number, url, state, is_draft, base_branch, updated_at
        FROM task_pr_links
        ORDER BY updated_at DESC
      `,
    )
    .all() as unknown as TaskPrLinkRow[]
  return rows.map(rowToRecord)
}

export function getTaskPrLinkByTaskId(db: DatabaseSync, taskId: string): TaskPrLinkRecord | null {
  const row = db
    .prepare(
      `
        SELECT task_id, branch, repo, number, url, state, is_draft, base_branch, updated_at
        FROM task_pr_links
        WHERE task_id = ?
      `,
    )
    .get(taskId) as unknown as TaskPrLinkRow | undefined
  return row ? rowToRecord(row) : null
}

export function upsertTaskPrLink(
  db: DatabaseSync,
  input: {
    taskId: string
    branch: string
    repo: string
    pr: TaskPrSummary
    updatedAt: string
  },
): void {
  db.prepare(
    `
      INSERT INTO task_pr_links (
        task_id, branch, repo, number, url, state, is_draft, base_branch, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        branch = excluded.branch,
        repo = excluded.repo,
        number = excluded.number,
        url = excluded.url,
        state = excluded.state,
        is_draft = excluded.is_draft,
        base_branch = excluded.base_branch,
        updated_at = excluded.updated_at
    `,
  ).run(
    input.taskId,
    input.branch,
    input.repo,
    input.pr.number,
    input.pr.url,
    input.pr.state,
    input.pr.isDraft ? 1 : 0,
    input.pr.baseBranch,
    input.updatedAt,
  )
}
