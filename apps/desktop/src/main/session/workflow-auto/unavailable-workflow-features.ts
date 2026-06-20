import type { WorkflowStructureFeatures } from '@planetz/shared'

/** Placeholder features when YAML resolve/parse fails; audit snapshot only. */
export function createUnavailableWorkflowFeatures(workflowName: string): WorkflowStructureFeatures {
  return {
    workflowName,
    source: 'builtin',
    canCompleteWithoutEditing: false,
    canCompleteBeforeFirstEdit: false,
    forcesImplementationOnAllPaths: false,
    hasImplementationPath: false,
    forcesTestWriting: false,
    requiresClearSpec: false,
    changeMode: 'read_only',
    primaryOutputs: [],
    dominantModes: [],
    targetSurfaces: ['general'],
    hasWriteTestsStep: false,
    hasReviewLoop: false,
    hasFixLoop: false,
    hasParallelReview: false,
    hasWorkflowCall: false,
    hasLoopMonitor: false,
    personaKeys: [],
    policyKeys: [],
    knowledgeKeys: [],
    instructionKeys: [],
    reportFormatKeys: [],
    stepCount: 0,
    editStepCount: 0,
    reviewStepCount: 0,
    investigateStepCount: 0,
    auditStepCount: 0,
    evidence: [
      {
        feature: 'features-unavailable',
        reason: 'YAML resolve or parse failed; placeholder snapshot for audit only',
        path: workflowName,
      },
    ],
  }
}
