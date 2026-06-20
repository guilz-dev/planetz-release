import { z } from 'zod'
import {
  type KiroSpecApprovalPhase,
  KiroSpecApprovalPhaseSchema,
  type KiroSpecSummary,
} from './kiro-spec-contract.js'
import type {
  TaskRoutingRequirements,
  WorkflowStructureFeatures,
} from './workflow-structure-routing-schema.js'

export const KiroRoutingPhaseSchema = z.enum([
  'none',
  'requirements',
  'design',
  'tasks',
  'complete',
])

export type KiroRoutingPhase = z.infer<typeof KiroRoutingPhaseSchema>

export const KiroRoutingContextSchema = z.object({
  specFeatureId: z.string().nullable(),
  kiroPhase: KiroRoutingPhaseSchema,
  phaseReason: z.string(),
})

export type KiroRoutingContext = z.infer<typeof KiroRoutingContextSchema>

export const KiroFeatureNeedingApprovalSchema = z.object({
  featureId: z.string().min(1),
  phase: KiroSpecApprovalPhaseSchema,
})

export type KiroFeatureNeedingApproval = z.infer<typeof KiroFeatureNeedingApprovalSchema>

export const kiroRoutingRequirementsSchema = KiroRoutingContextSchema

export type KiroRoutingRequirements = KiroRoutingContext

function isPhaseApproved(summary: KiroSpecSummary, phase: KiroSpecApprovalPhase): boolean {
  if (summary.parseStatus !== 'ok') return false
  return summary.approvals?.[phase]?.approved === true
}

export function resolveKiroRoutingPhase(summary: KiroSpecSummary | null): KiroRoutingPhase {
  if (!summary || summary.parseStatus !== 'ok') return 'none'
  if (!isPhaseApproved(summary, 'requirements')) return 'requirements'
  if (!isPhaseApproved(summary, 'design')) return 'design'
  if (!isPhaseApproved(summary, 'tasks')) return 'tasks'
  return 'complete'
}

export function resolveKiroPhaseReason(phase: KiroRoutingPhase, featureId: string | null): string {
  if (phase === 'none') return 'no kiro spec'
  if (phase === 'complete') return featureId ? `${featureId}: all phases approved` : 'complete'
  const label = featureId ?? 'feature'
  return `${label}: ${phase} not approved`
}

export function resolvePrimaryKiroFeature(specs: KiroSpecSummary[]): KiroSpecSummary | null {
  const okSpecs = specs.filter((spec) => spec.parseStatus === 'ok')
  if (okSpecs.length === 0) return null
  for (const spec of okSpecs) {
    const phase = resolveKiroRoutingPhase(spec)
    if (phase !== 'complete' && phase !== 'none') return spec
  }
  return okSpecs[0] ?? null
}

export function listKiroFeaturesNeedingApproval(
  specs: KiroSpecSummary[],
): KiroFeatureNeedingApproval[] {
  const out: KiroFeatureNeedingApproval[] = []
  for (const spec of specs) {
    if (spec.parseStatus !== 'ok') continue
    for (const phase of KiroSpecApprovalPhaseSchema.options) {
      if (!isPhaseApproved(spec, phase)) {
        out.push({ featureId: spec.featureId, phase })
      }
    }
  }
  return out
}

export function kiroPhaseBlocksImplementation(phase: KiroRoutingPhase): boolean {
  return phase !== 'none' && phase !== 'complete'
}

export function resolveKiroRoutingContextFromSpecs(
  specs: KiroSpecSummary[],
): KiroRoutingContext | null {
  const primary = resolvePrimaryKiroFeature(specs)
  if (!primary) return null
  const kiroPhase = resolveKiroRoutingPhase(primary)
  if (kiroPhase === 'none') return null
  return {
    specFeatureId: primary.featureId,
    kiroPhase,
    phaseReason: resolveKiroPhaseReason(kiroPhase, primary.featureId),
  }
}

/** Score multiplier favoring spec-phase workflows while kiro blocks implementation. */
export function kiroSpecPhaseScoreBoost(
  kiroPhase: KiroRoutingPhase,
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  if (!kiroPhaseBlocksImplementation(kiroPhase)) return 1
  const specFriendly =
    features.canCompleteWithoutEditing && !features.forcesImplementationOnAllPaths
  if (!specFriendly) return 1

  if (kiroPhase === 'requirements') {
    const reportFocus =
      requirements.expectedOutput.includes('report') || requirements.intent.includes('investigate')
    return reportFocus ? 1.35 : 1.25
  }
  if (kiroPhase === 'design') {
    return requirements.intent.includes('investigate') ? 1.2 : 1.15
  }
  return 1.15
}

export function applyKiroPhaseToRequirements(
  requirements: TaskRoutingRequirements,
  ctx: KiroRoutingContext | null,
): TaskRoutingRequirements {
  if (!ctx || ctx.kiroPhase === 'none' || ctx.kiroPhase === 'complete') {
    const { kiroRouting: _drop, ...rest } = requirements
    return rest
  }
  let implementationAlreadyDecided = requirements.implementationAlreadyDecided
  if (kiroPhaseBlocksImplementation(ctx.kiroPhase)) {
    implementationAlreadyDecided = false
  }
  return {
    ...requirements,
    implementationAlreadyDecided,
    kiroRouting: {
      specFeatureId: ctx.specFeatureId,
      kiroPhase: ctx.kiroPhase,
      phaseReason: ctx.phaseReason,
    },
  }
}
