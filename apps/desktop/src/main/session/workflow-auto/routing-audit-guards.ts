import type { WorkflowRoutingAuditRecord } from '@planetz/shared'

/** True when the workflow was hard-rejected in this routing candidate pool. */
export function isHardRejectedInRoutingPool(
  pool: WorkflowRoutingAuditRecord['candidatePool'],
  workflowName: string,
): boolean {
  return pool.some((candidate) => candidate.workflow === workflowName && candidate.rejected)
}

/** Safety KPI: selected workflow must not be a hard-rejected pool member. */
export function selectedWorkflowViolatesHardRejectPool(
  audit: Pick<WorkflowRoutingAuditRecord, 'candidatePool' | 'selectedWorkflow'>,
): boolean {
  return isHardRejectedInRoutingPool(audit.candidatePool, audit.selectedWorkflow)
}
