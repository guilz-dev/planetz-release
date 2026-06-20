import type { DatabaseSync } from 'node:sqlite'
import { autoWorkflowDecisionSchema, type PromptHistoryItem } from '@planetz/shared'

type PromptHistoryRow = {
  id: string
  title: string
  body: string
  workflow: string | null
  auto_decision_json: string | null
  assigned_agent_id: string | null
  issue_ref: string | null
  submitted_task_id: string | null
  status: string
  created_at: string
  updated_at: string
}

function parseAutoDecisionJson(raw: string | null): PromptHistoryItem['autoDecision'] {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    return autoWorkflowDecisionSchema.parse(parsed)
  } catch {
    return undefined
  }
}

function rowToItem(row: PromptHistoryRow): PromptHistoryItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    workflow: row.workflow ?? undefined,
    autoDecision: parseAutoDecisionJson(row.auto_decision_json),
    assignedAgentId: row.assigned_agent_id ?? undefined,
    issueRef: row.issue_ref ?? undefined,
    submittedTaskId: row.submitted_task_id ?? undefined,
    status: row.status as PromptHistoryItem['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listPromptHistory(db: DatabaseSync, limit: number): PromptHistoryItem[] {
  const rows = db
    .prepare(
      `
        SELECT id, title, body, workflow, auto_decision_json, assigned_agent_id,
               issue_ref, submitted_task_id, status, created_at, updated_at
        FROM prompt_history
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?
      `,
    )
    .all(limit) as PromptHistoryRow[]
  return rows.map(rowToItem)
}

export function insertPromptHistory(db: DatabaseSync, item: PromptHistoryItem): void {
  const autoDecisionJson =
    item.autoDecision !== undefined ? JSON.stringify(item.autoDecision) : null
  db.prepare(
    `
      INSERT INTO prompt_history (
        id, title, body, workflow, auto_decision_json, assigned_agent_id,
        issue_ref, submitted_task_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    item.id,
    item.title,
    item.body,
    item.workflow ?? null,
    autoDecisionJson,
    item.assignedAgentId ?? null,
    item.issueRef ?? null,
    item.submittedTaskId ?? null,
    item.status,
    item.createdAt,
    item.updatedAt,
  )
}

export function deletePromptHistoryById(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM prompt_history WHERE id = ?').run(id)
}

export function trimPromptHistory(db: DatabaseSync, maxItems: number): void {
  db.prepare(
    `
      DELETE FROM prompt_history
      WHERE id NOT IN (
        SELECT id FROM prompt_history ORDER BY created_at DESC, rowid DESC LIMIT ?
      )
    `,
  ).run(maxItems)
}

export function replaceAllPromptHistory(db: DatabaseSync, items: PromptHistoryItem[]): void {
  db.prepare('DELETE FROM prompt_history').run()
  for (const item of items) {
    insertPromptHistory(db, item)
  }
}
