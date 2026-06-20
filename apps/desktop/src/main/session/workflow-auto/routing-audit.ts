import {
  type AutoWorkflowDecision,
  type AutoWorkflowDecisionLlmMeta,
  redactRoutingAuditRecord,
  type TaskRoutingRequirements,
  toWorkflowFeatureSnapshot,
  type WorkflowRoutingAuditRecord,
} from '@planetz/shared'
import type { StructureRoutingCandidate } from './candidate-builder.js'

export function buildWorkflowRoutingAuditRecord(input: {
  requirements: TaskRoutingRequirements
  pool: StructureRoutingCandidate[]
  decision: Pick<
    AutoWorkflowDecision,
    'selectedWorkflow' | 'confidence' | 'reasonCodes' | 'fallbackApplied'
  >
  decisionReason?: string
  comparedDifferences?: string[]
  llm?: {
    requirements?: AutoWorkflowDecisionLlmMeta
    final?: AutoWorkflowDecisionLlmMeta
  }
}): WorkflowRoutingAuditRecord {
  const record: WorkflowRoutingAuditRecord = {
    version: 1,
    at: new Date().toISOString(),
    taskRequirements: input.requirements,
    candidatePool: input.pool.map((candidate) => ({
      workflow: candidate.workflowName,
      score: candidate.score,
      rejected: candidate.rejected,
      rejectReasons: [...candidate.rejectReasons],
      matchedFeatures: [...candidate.matchedFeatures],
      ...(candidate.safetyTier ? { safetyTier: candidate.safetyTier } : {}),
      featureSnapshot: toWorkflowFeatureSnapshot(candidate.features),
    })),
    selectedWorkflow: input.decision.selectedWorkflow,
    confidence: input.decision.confidence,
    decisionReason: input.decisionReason ?? '',
    comparedDifferences: input.comparedDifferences ?? [],
    ...(input.llm ? { llm: input.llm } : {}),
  }
  return redactRoutingAuditRecord(record)
}
