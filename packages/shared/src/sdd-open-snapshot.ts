import { z } from 'zod'
import {
  type KiroFeatureNeedingApproval,
  KiroFeatureNeedingApprovalSchema,
  type KiroRoutingPhase,
  KiroRoutingPhaseSchema,
  kiroPhaseBlocksImplementation,
  listKiroFeaturesNeedingApproval,
  resolveKiroRoutingContextFromSpecs,
  resolveKiroRoutingPhase,
  resolvePrimaryKiroFeature,
} from './kiro-phase-routing.js'
import type { KiroSpecSummary } from './kiro-spec-contract.js'

export const SddRecommendedEntrySchema = z.preprocess(
  (value) => (value === 'spec-desk' ? 'spec-studio' : value),
  z.enum(['dashboard', 'spec-studio', 'decisions']),
)

export type SddRecommendedEntry = z.infer<typeof SddRecommendedEntrySchema>

export const SddOpenSnapshotSchema = z.object({
  intentLedgerPendingCount: z.number().int().nonnegative(),
  intentLedgerUnanchoredCount: z.number().int().nonnegative(),
  kiroSpecCount: z.number().int().nonnegative(),
  featuresNeedingApproval: z.array(KiroFeatureNeedingApprovalSchema),
  recommendedEntry: SddRecommendedEntrySchema,
  kiroPhase: KiroRoutingPhaseSchema.optional(),
  specFeatureId: z.string().nullable().optional(),
  phaseReason: z.string().optional(),
})

export type SddOpenSnapshot = z.infer<typeof SddOpenSnapshotSchema>

export function resolveSddRecommendedEntry(input: {
  pendingCount: number
  unanchoredCount: number
  featuresNeedingApproval: KiroFeatureNeedingApproval[]
  kiroPhase: KiroRoutingPhase
}): SddRecommendedEntry {
  if (input.unanchoredCount > 0) return 'decisions'
  if (input.pendingCount > 0 && input.kiroPhase === 'complete') return 'decisions'
  if (input.featuresNeedingApproval.length > 0 || kiroPhaseBlocksImplementation(input.kiroPhase)) {
    return 'spec-studio'
  }
  return 'dashboard'
}

/** Composer guide when kiro blocks implementation (proxy for implementationAlreadyDecided=false). */
export function shouldShowSpecStudioComposerGuide(snapshot: SddOpenSnapshot): boolean {
  if (snapshot.recommendedEntry !== 'spec-studio') return false
  return kiroPhaseBlocksImplementation(snapshot.kiroPhase ?? 'none')
}

/** @deprecated Use {@link shouldShowSpecStudioComposerGuide}. */
export const shouldShowSpecDeskComposerGuide = shouldShowSpecStudioComposerGuide

export function sddOpenSnapshotKiroFingerprint(
  snapshot: Pick<
    SddOpenSnapshot,
    'kiroSpecCount' | 'featuresNeedingApproval' | 'kiroPhase' | 'specFeatureId'
  >,
): string {
  return JSON.stringify({
    kiroSpecCount: snapshot.kiroSpecCount,
    featuresNeedingApproval: snapshot.featuresNeedingApproval,
    kiroPhase: snapshot.kiroPhase ?? 'none',
    specFeatureId: snapshot.specFeatureId ?? null,
  })
}

export function sddOpenKiroFingerprintFromSpecs(specs: KiroSpecSummary[]): string {
  const featuresNeedingApproval = listKiroFeaturesNeedingApproval(specs)
  const primary = resolvePrimaryKiroFeature(specs)
  const kiroCtx = resolveKiroRoutingContextFromSpecs(specs)
  return sddOpenSnapshotKiroFingerprint({
    kiroSpecCount: specs.length,
    featuresNeedingApproval,
    kiroPhase: kiroCtx?.kiroPhase ?? (primary ? resolveKiroRoutingPhase(primary) : undefined),
    specFeatureId: kiroCtx?.specFeatureId ?? primary?.featureId ?? null,
  })
}

export function isSddOpenKiroCacheStale(
  specs: KiroSpecSummary[],
  cached: SddOpenSnapshot,
): boolean {
  return sddOpenKiroFingerprintFromSpecs(specs) !== sddOpenSnapshotKiroFingerprint(cached)
}

export function sddOpenSnapshotLedgerFingerprint(snapshot: SddOpenSnapshot): string {
  return JSON.stringify({
    pending: snapshot.intentLedgerPendingCount,
    unanchored: snapshot.intentLedgerUnanchoredCount,
    recommendedEntry: snapshot.recommendedEntry,
    kiro: sddOpenSnapshotKiroFingerprint(snapshot),
  })
}
