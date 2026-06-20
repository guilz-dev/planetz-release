import type {
  AutoWorkflowDecision,
  AutoWorkflowLlmFailureCode,
  WorkflowFinalSelection,
} from '@planetz/shared'
import type { StructureRoutingCandidate } from './candidate-builder.js'

const CONFIDENCE_SCORE: Record<WorkflowFinalSelection['confidence'], number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
}

export type WorkflowAutoValidationResult =
  | { ok: true; decision: Omit<AutoWorkflowDecision, 'fallbackApplied' | 'llm'> }
  | {
      ok: false
      failureCode: AutoWorkflowLlmFailureCode
      fallbackReasonCode: string
    }

export function validateWorkflowFinalSelection(input: {
  output: WorkflowFinalSelection
  candidates: StructureRoutingCandidate[]
}): WorkflowAutoValidationResult {
  const candidateNames = new Set(input.candidates.map((c) => c.workflowName))
  if (!candidateNames.has(input.output.selectedWorkflow)) {
    return {
      ok: false,
      failureCode: 'invalid-workflow',
      fallbackReasonCode: 'fallback:invalid-workflow',
    }
  }

  const entry = input.candidates.find((c) => c.workflowName === input.output.selectedWorkflow)
  if (!entry) {
    return {
      ok: false,
      failureCode: 'invalid-workflow',
      fallbackReasonCode: 'fallback:invalid-workflow',
    }
  }

  if (input.output.confidence === 'low') {
    return {
      ok: false,
      failureCode: 'invalid-workflow',
      fallbackReasonCode: 'fallback:low-confidence',
    }
  }

  if (entry.safetyTier === 'strict' && input.output.confidence !== 'high') {
    return {
      ok: false,
      failureCode: 'invalid-workflow',
      fallbackReasonCode: 'fallback:strict-gate',
    }
  }

  const score = CONFIDENCE_SCORE[input.output.confidence]
  const alternatives = input.candidates
    .filter((c) => c.workflowName !== input.output.selectedWorkflow && !c.rejected)
    .slice(0, 3)
    .map((alt) => ({
      name: alt.workflowName,
      group: alt.group,
      score: Math.max(0, score - 0.1),
    }))

  return {
    ok: true,
    decision: {
      selectedWorkflow: input.output.selectedWorkflow,
      group: entry.group,
      confidence: input.output.confidence,
      score,
      alternatives,
      reasonCodes: [...entry.matchedFeatures, 'llm:final-compare'],
    },
  }
}
