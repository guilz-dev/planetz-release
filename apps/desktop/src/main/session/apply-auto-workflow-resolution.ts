import type {
  AutoWorkflowDecision,
  EnqueueTaskBridgeInput,
  WorkflowRoutingAuditRecord,
  WorkflowRoutingCatalog,
} from '@planetz/shared'
import { routeWorkflowAuto, type WorkflowAutoRouteContext } from './workflow-auto/router.js'

export type AutoWorkflowResolution = {
  input: EnqueueTaskBridgeInput
  autoDecision?: AutoWorkflowDecision
  routingAudit?: WorkflowRoutingAuditRecord
}

export async function applyAutoWorkflowResolution(
  input: EnqueueTaskBridgeInput,
  catalog: WorkflowRoutingCatalog,
  availableWorkflowNames: string[],
  ctx: WorkflowAutoRouteContext,
): Promise<AutoWorkflowResolution> {
  const mode = input.workflowMode ?? 'manual'
  if (mode !== 'auto') {
    return { input }
  }

  const prompt = [input.title, input.body]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .trim()

  const routed = await routeWorkflowAuto(
    {
      prompt,
      catalog,
      availableWorkflowNames,
    },
    ctx,
  )

  return {
    input: {
      ...input,
      workflow: routed.decision.selectedWorkflow,
      workflowMode: 'manual',
    },
    autoDecision: routed.decision,
    routingAudit: routed.audit,
  }
}
