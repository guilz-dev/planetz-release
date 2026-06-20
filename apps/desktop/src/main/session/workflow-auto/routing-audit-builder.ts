import type {
  AutoWorkflowDecision,
  AutoWorkflowDecisionLlmMeta,
  WorkflowRoutingAuditRecord,
} from '@planetz/shared'
import type { StructureRoutingCandidate } from './candidate-builder.js'
import { buildWorkflowRoutingAuditRecord } from './routing-audit.js'
import type { TaskRequirementsExtractResult } from './task-requirements.js'

export function buildRoutingAuditRecord(input: {
  requirementsResult: TaskRequirementsExtractResult
  pool: StructureRoutingCandidate[]
  decision: AutoWorkflowDecision
  decisionReason?: string
  comparedDifferences?: string[]
  llm?: WorkflowRoutingAuditRecord['llm']
}): WorkflowRoutingAuditRecord {
  const { requirementsResult, pool, decision, decisionReason, comparedDifferences, llm } = input
  const requirementsMeta = requirementsResult.meta
  const requirementsLlm: AutoWorkflowDecisionLlmMeta | undefined = requirementsMeta
    ? {
        provider: requirementsMeta.provider,
        model: requirementsMeta.model,
        latencyMs: requirementsMeta.latencyMs,
        failureCode: requirementsMeta.failureCode,
      }
    : undefined

  return buildWorkflowRoutingAuditRecord({
    requirements: requirementsResult.requirements,
    pool,
    decision,
    decisionReason,
    comparedDifferences,
    llm: {
      ...(requirementsLlm ? { requirements: requirementsLlm } : {}),
      ...llm,
    },
  })
}
