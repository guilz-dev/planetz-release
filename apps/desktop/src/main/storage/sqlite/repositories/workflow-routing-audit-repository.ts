import type { DatabaseSync } from 'node:sqlite'
import { type WorkflowRoutingAuditRecord, workflowRoutingAuditRecordSchema } from '@planetz/shared'

export function insertWorkflowRoutingAudit(
  db: DatabaseSync,
  taskId: string,
  record: WorkflowRoutingAuditRecord,
): void {
  const validated = workflowRoutingAuditRecordSchema.parse(record)
  db.prepare(
    `
    INSERT INTO workflow_routing_audit (task_id, record_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      record_json = excluded.record_json,
      created_at = excluded.created_at
  `,
  ).run(taskId, JSON.stringify(validated), validated.at)
}

export function readWorkflowRoutingAudit(
  db: DatabaseSync,
  taskId: string,
): WorkflowRoutingAuditRecord | null {
  const row = db
    .prepare(
      `
    SELECT record_json
    FROM workflow_routing_audit
    WHERE task_id = ?
  `,
    )
    .get(taskId) as { record_json?: string } | undefined
  if (!row?.record_json?.trim()) return null
  try {
    return workflowRoutingAuditRecordSchema.parse(JSON.parse(row.record_json))
  } catch {
    return null
  }
}
