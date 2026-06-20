import {
  type AutoWorkflowDecision,
  ROUTING_REASON_CODES,
  type WorkflowRoutingCatalog,
} from '@planetz/shared'
import {
  buildFallbackDecision,
  resolveSafeFallbackWorkflowName,
} from '../workflow-auto-fallback.js'

export function traceWorkflowAutoFallback(reason: string, fields?: Record<string, unknown>): void {
  if (process.env.PLANETZ_TRACE_ENQUEUE !== '1') return
  const at = new Date().toISOString()
  if (fields) {
    console.info(`[enqueue][${at}] workflowAuto:fallback ${reason}`, fields)
    return
  }
  console.info(`[enqueue][${at}] workflowAuto:fallback ${reason}`)
}

export function finalizeRoutingFallback(
  catalog: WorkflowRoutingCatalog,
  availableWorkflowNames: string[],
  reasonCodes: string[],
  preferredWorkflow?: string,
  llm?: AutoWorkflowDecision['llm'],
  excludedWorkflowNames?: ReadonlySet<string>,
): AutoWorkflowDecision {
  const excluded = excludedWorkflowNames ?? new Set<string>()
  const safeWorkflow = resolveSafeFallbackWorkflowName({
    catalog,
    availableWorkflowNames,
    excludedWorkflowNames: excluded,
    preferredWorkflow,
  })
  const codes =
    safeWorkflow === null
      ? [...reasonCodes, ROUTING_REASON_CODES.fallback.noSafeWorkflow]
      : reasonCodes
  // Enqueue continuity: when every enabled workflow was hard-rejected, `default` may still be chosen.
  const fallbackWorkflow = safeWorkflow ?? 'default'
  return {
    ...buildFallbackDecision(fallbackWorkflow, codes, catalog),
    ...(llm ? { llm } : {}),
  }
}

export function routingFallbackReasonCode(failureCode: string): string {
  return failureCode === 'invalid-json'
    ? ROUTING_REASON_CODES.fallback.invalidJson
    : `fallback:${failureCode}`
}
