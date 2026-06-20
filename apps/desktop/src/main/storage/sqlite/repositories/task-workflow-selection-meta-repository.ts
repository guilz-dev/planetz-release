import type { DatabaseSync } from 'node:sqlite'
import { type TaskWorkflowSelectionMeta, taskWorkflowSelectionMetaSchema } from '@planetz/shared'

export type TaskWorkflowSelectionMetaRow = TaskWorkflowSelectionMeta & {
  taskId: string
  updatedAt: string
}

export function insertTaskWorkflowSelectionMeta(
  db: DatabaseSync,
  taskId: string,
  meta: TaskWorkflowSelectionMeta,
  updatedAt: string,
): void {
  const parsed = taskWorkflowSelectionMetaSchema.parse(meta)
  db.prepare(
    `
    INSERT INTO task_workflow_selection_meta (
      task_id, kind, base_workflow, resolved_workflow, run_override_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      kind = excluded.kind,
      base_workflow = excluded.base_workflow,
      resolved_workflow = excluded.resolved_workflow,
      run_override_json = excluded.run_override_json,
      updated_at = excluded.updated_at
  `,
  ).run(
    taskId,
    parsed.kind,
    parsed.baseWorkflow,
    parsed.resolvedWorkflow ?? null,
    parsed.runOverrideJson ?? (parsed.runOverride ? JSON.stringify(parsed.runOverride) : null),
    updatedAt,
  )
}

export function listTaskWorkflowSelectionMeta(
  db: DatabaseSync,
  taskIds?: ReadonlySet<string>,
): Map<string, TaskWorkflowSelectionMetaRow> {
  const rows = db
    .prepare(
      `
    SELECT task_id, kind, base_workflow, resolved_workflow, run_override_json, updated_at
    FROM task_workflow_selection_meta
  `,
    )
    .all() as Array<{
    task_id: string
    kind: string
    base_workflow: string
    resolved_workflow: string | null
    run_override_json: string | null
    updated_at: string
  }>

  const out = new Map<string, TaskWorkflowSelectionMetaRow>()
  for (const row of rows) {
    if (taskIds && !taskIds.has(row.task_id)) continue
    const runOverrideJson = row.run_override_json ?? undefined
    out.set(row.task_id, {
      taskId: row.task_id,
      updatedAt: row.updated_at,
      kind: row.kind as TaskWorkflowSelectionMeta['kind'],
      baseWorkflow: row.base_workflow,
      ...(row.resolved_workflow ? { resolvedWorkflow: row.resolved_workflow } : {}),
      ...(runOverrideJson ? { runOverrideJson } : {}),
    })
  }
  return out
}

export function deleteTaskWorkflowSelectionMeta(db: DatabaseSync, taskId: string): void {
  db.prepare('DELETE FROM task_workflow_selection_meta WHERE task_id = ?').run(taskId)
}
