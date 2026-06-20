import { z } from 'zod'
import { kiroRoutingRequirementsSchema } from './kiro-phase-routing.js'
import {
  autoWorkflowDecisionLlmMetaSchema,
  autoWorkflowLlmFailureCodeSchema,
} from './workflow-auto-routing-schema.js'

export const routingIntentSchema = z.enum([
  'investigate',
  'implement',
  'review',
  'audit',
  'refactor',
])

export const routingExpectedOutputSchema = z.enum(['report', 'code', 'tests', 'review-findings'])

export const routingTargetSurfaceSchema = z.enum([
  'frontend',
  'backend',
  'fullstack',
  'infra',
  'security',
  'testing',
  'cqrs',
  'general',
])

export const routingAmbiguitySchema = z.enum(['low', 'medium', 'high'])

export const workflowChangeModeSchema = z.enum(['read_only', 'mixed', 'edit_heavy'])

export const workflowPrimaryOutputSchema = z.enum(['report', 'code', 'tests', 'review-findings'])

export const workflowDominantModeSchema = z.enum([
  'investigate',
  'implement',
  'review',
  'audit',
  'refactor',
])

export const workflowFeatureSourceSchema = z.enum(['project', 'imported', 'builtin'])

export type RoutingIntent = z.infer<typeof routingIntentSchema>
export type RoutingExpectedOutput = z.infer<typeof routingExpectedOutputSchema>
export type RoutingTargetSurface = z.infer<typeof routingTargetSurfaceSchema>
export type RoutingAmbiguity = z.infer<typeof routingAmbiguitySchema>
export type WorkflowChangeMode = z.infer<typeof workflowChangeModeSchema>
export type WorkflowPrimaryOutput = z.infer<typeof workflowPrimaryOutputSchema>
export type WorkflowDominantMode = z.infer<typeof workflowDominantModeSchema>
export type WorkflowFeatureSource = z.infer<typeof workflowFeatureSourceSchema>

export const taskRoutingRequirementsSchema = z.object({
  intent: z.array(routingIntentSchema).default([]),
  expectedOutput: z.array(routingExpectedOutputSchema).default([]),
  mayModifyCode: z.boolean(),
  implementationAlreadyDecided: z.boolean(),
  needsRootCauseAnalysis: z.boolean().default(false),
  needsTestWriting: z.boolean().default(false),
  needsDeepReview: z.boolean().default(false),
  targetSurfaces: z.array(routingTargetSurfaceSchema).default(['general']),
  ambiguity: routingAmbiguitySchema.default('medium'),
  blockingUnknowns: z.array(z.string()).default([]),
  kiroRouting: kiroRoutingRequirementsSchema.optional(),
})

export type TaskRoutingRequirements = z.infer<typeof taskRoutingRequirementsSchema>

export const workflowFeatureEvidenceSchema = z.object({
  feature: z.string(),
  reason: z.string(),
  path: z.string(),
})

export const workflowStructureFeaturesSchema = z.object({
  workflowName: z.string(),
  source: workflowFeatureSourceSchema,

  canCompleteWithoutEditing: z.boolean(),
  canCompleteBeforeFirstEdit: z.boolean(),
  forcesImplementationOnAllPaths: z.boolean(),
  hasImplementationPath: z.boolean(),
  forcesTestWriting: z.boolean(),
  requiresClearSpec: z.boolean(),

  changeMode: workflowChangeModeSchema,
  primaryOutputs: z.array(workflowPrimaryOutputSchema),
  dominantModes: z.array(workflowDominantModeSchema),
  targetSurfaces: z.array(routingTargetSurfaceSchema),

  hasWriteTestsStep: z.boolean(),
  hasReviewLoop: z.boolean(),
  hasFixLoop: z.boolean(),
  hasParallelReview: z.boolean(),
  hasWorkflowCall: z.boolean(),
  hasLoopMonitor: z.boolean(),

  personaKeys: z.array(z.string()),
  policyKeys: z.array(z.string()),
  knowledgeKeys: z.array(z.string()),
  instructionKeys: z.array(z.string()),
  reportFormatKeys: z.array(z.string()),

  stepCount: z.number().int().nonnegative(),
  editStepCount: z.number().int().nonnegative(),
  reviewStepCount: z.number().int().nonnegative(),
  investigateStepCount: z.number().int().nonnegative(),
  auditStepCount: z.number().int().nonnegative(),

  evidence: z.array(workflowFeatureEvidenceSchema),
})

export type WorkflowStructureFeatures = z.infer<typeof workflowStructureFeaturesSchema>
export type WorkflowFeatureEvidence = z.infer<typeof workflowFeatureEvidenceSchema>

export const workflowFeatureSnapshotSchema = z.object({
  forcesImplementationOnAllPaths: z.boolean(),
  canCompleteWithoutEditing: z.boolean(),
  canCompleteBeforeFirstEdit: z.boolean(),
  hasImplementationPath: z.boolean(),
  changeMode: workflowChangeModeSchema,
  hasWriteTestsStep: z.boolean(),
  dominantModes: z.array(workflowDominantModeSchema),
})

export type WorkflowFeatureSnapshot = z.infer<typeof workflowFeatureSnapshotSchema>

export const workflowFinalSelectionSchema = z.object({
  selectedWorkflow: z.string().trim().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  decisionReason: z.string(),
  comparedDifferences: z.array(z.string()).default([]),
})

export type WorkflowFinalSelection = z.infer<typeof workflowFinalSelectionSchema>

export const finalSelectionCandidateSummarySchema = z.object({
  workflowName: z.string().trim().min(1),
  deterministicRank: z.number().int().positive(),
  deterministicScore: z.number(),
  matchedFeatures: z.array(z.string()).default([]),
  routingGroups: z.array(z.string()).default([]),
  complexityBand: z.enum(['low', 'medium', 'high']).optional(),
  safetyTier: z.enum(['safe', 'strict']).optional(),
  changeMode: workflowChangeModeSchema,
  primaryOutputs: z.array(workflowPrimaryOutputSchema),
  dominantModes: z.array(workflowDominantModeSchema),
  targetSurfaces: z.array(routingTargetSurfaceSchema),
  canCompleteWithoutEditing: z.boolean(),
  canCompleteBeforeFirstEdit: z.boolean(),
  hasWriteTestsStep: z.boolean(),
  hasReviewLoop: z.boolean(),
  stepCount: z.number().int().nonnegative(),
  editStepCount: z.number().int().nonnegative(),
  shortReason: z.string(),
})

export type FinalSelectionCandidateSummary = z.infer<typeof finalSelectionCandidateSummarySchema>

export const workflowRoutingAuditCandidateSchema = z.object({
  workflow: z.string(),
  score: z.number(),
  rejected: z.boolean(),
  rejectReasons: z.array(z.string()).default([]),
  matchedFeatures: z.array(z.string()).default([]),
  safetyTier: z.enum(['safe', 'strict']).optional(),
  featureSnapshot: workflowFeatureSnapshotSchema,
})

export const workflowRoutingAuditLlmSchema = z.object({
  requirements: autoWorkflowDecisionLlmMetaSchema.optional(),
  final: autoWorkflowDecisionLlmMetaSchema.optional(),
})

export const workflowRoutingAuditRecordSchema = z.object({
  version: z.literal(1),
  at: z.string(),
  taskRequirements: taskRoutingRequirementsSchema,
  candidatePool: z.array(workflowRoutingAuditCandidateSchema),
  selectedWorkflow: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  decisionReason: z.string().default(''),
  comparedDifferences: z.array(z.string()).default([]),
  llm: workflowRoutingAuditLlmSchema.optional(),
})

export type WorkflowRoutingAuditRecord = z.infer<typeof workflowRoutingAuditRecordSchema>

/** Structured reason codes for auto routing (Phase 2 i18n). */
export const ROUTING_REASON_CODES = {
  reject: {
    forcesImplementationOnAllPaths: 'reject:forces-implementation-on-all-paths',
    editHeavyReadOnly: 'reject:edit-heavy-read-only',
    reportOutputMismatch: 'reject:report-output-mismatch',
    weakReviewAuditFeatures: 'reject:weak-review-audit-features',
    featuresUnavailable: 'reject:features-unavailable',
    highComplexityBandForSimpleTask: 'reject:high-complexity-band-for-simple-task',
    kiroPhaseBlocksImplementation: 'reject:kiro-phase-blocks-implementation',
    /** Alias for audit logs that referenced the pre-PR-13 code string. */
    kiroTasksNotApproved: 'reject:kiro-phase-blocks-implementation',
  },
  match: {
    reportOnlyCompletion: 'match:report-only-completion',
    structureFit: 'match:structure-fit',
    complexityPreferLightweight: 'match:complexity-prefer-lightweight',
    kiroSpecPhase: 'match:kiro-spec-phase',
  },
  requirements: {
    fallback: 'requirements:fallback',
    noProvider: 'requirements:no-provider',
    llm: 'requirements:llm',
    kiroPhaseGate: 'requirements:kiro-phase-gate',
  },
  fallback: {
    allRejected: 'fallback:all-rejected',
    emptyPrompt: 'fallback:empty-prompt',
    noProvider: 'fallback:no-provider',
    invalidJson: 'fallback:invalid-json',
    invalidWorkflow: 'fallback:invalid-workflow',
    lowConfidence: 'fallback:low-confidence',
    strictGate: 'fallback:strict-gate',
    default: 'fallback:default',
    noSafeWorkflow: 'fallback:no-safe-workflow',
  },
  routing: {
    singleCandidate: 'routing:single-candidate',
    deterministicShortCircuit: 'routing:deterministic-short-circuit',
    finalCompare: 'llm:final-compare',
  },
} as const

export { autoWorkflowLlmFailureCodeSchema }

export function toWorkflowFeatureSnapshot(
  features: WorkflowStructureFeatures,
): WorkflowFeatureSnapshot {
  return {
    forcesImplementationOnAllPaths: features.forcesImplementationOnAllPaths,
    canCompleteWithoutEditing: features.canCompleteWithoutEditing,
    canCompleteBeforeFirstEdit: features.canCompleteBeforeFirstEdit,
    hasImplementationPath: features.hasImplementationPath,
    changeMode: features.changeMode,
    hasWriteTestsStep: features.hasWriteTestsStep,
    dominantModes: [...features.dominantModes],
  }
}
