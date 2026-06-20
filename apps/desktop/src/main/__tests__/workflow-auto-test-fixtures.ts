import type { TaskRoutingRequirements, WorkflowStructureFeatures } from '@planetz/shared'

export const INVESTIGATE_ONLY_YAML = `name: investigate-only
initial_step: plan
steps:
  - name: plan
    edit: false
    persona: researcher
    rules:
      - condition: done
        next: COMPLETE
`

/** Planetz `default` wrapper: plan then workflow_call into draft subworkflow. */
export const DEFAULT_WRAPPER_YAML = `name: default
initial_step: plan
steps:
  - name: plan
    edit: false
    persona: planner
    rules:
      - condition: Planning complete
        next: draft
  - name: draft
    kind: workflow_call
    call: default-draft-minimal
    rules:
      - condition: COMPLETE
        next: COMPLETE
`

export const IMPLEMENT_HEAVY_YAML = `name: implement-heavy
initial_step: implement
steps:
  - name: implement
    edit: true
    persona: coder
    rules:
      - condition: done
        next: COMPLETE
`

/** At least one path completes before first edit; another path requires edit. */
export const MIXED_COMPLETION_PATHS_YAML = `name: mixed-paths
initial_step: plan
steps:
  - name: plan
    edit: false
    persona: researcher
    rules:
      - condition: report only
        next: COMPLETE
      - condition: implement
        next: implement
  - name: implement
    edit: true
    persona: coder
    rules:
      - condition: done
        next: COMPLETE
`

export const lowComplexityImplementTask: TaskRoutingRequirements = {
  intent: ['implement'],
  expectedOutput: ['code'],
  mayModifyCode: true,
  implementationAlreadyDecided: true,
  needsRootCauseAnalysis: false,
  needsTestWriting: false,
  needsDeepReview: false,
  targetSurfaces: ['general'],
  ambiguity: 'low',
  blockingUnknowns: [],
}

export const highComplexityFeatureTask: TaskRoutingRequirements = {
  intent: ['investigate', 'implement'],
  expectedOutput: ['report', 'code'],
  mayModifyCode: true,
  implementationAlreadyDecided: false,
  needsRootCauseAnalysis: true,
  needsTestWriting: true,
  needsDeepReview: true,
  targetSurfaces: ['frontend', 'backend'],
  ambiguity: 'high',
  blockingUnknowns: ['scope unclear'],
}

export function minimalFeatures(
  workflowName: string,
  overrides: Partial<WorkflowStructureFeatures> = {},
): WorkflowStructureFeatures {
  return {
    workflowName,
    source: 'builtin',
    canCompleteWithoutEditing: false,
    canCompleteBeforeFirstEdit: false,
    forcesImplementationOnAllPaths: true,
    hasImplementationPath: true,
    forcesTestWriting: false,
    requiresClearSpec: false,
    changeMode: 'edit_heavy',
    primaryOutputs: ['code'],
    dominantModes: ['implement'],
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
    stepCount: 1,
    editStepCount: 1,
    reviewStepCount: 0,
    investigateStepCount: 0,
    auditStepCount: 0,
    evidence: [],
    ...overrides,
  }
}
