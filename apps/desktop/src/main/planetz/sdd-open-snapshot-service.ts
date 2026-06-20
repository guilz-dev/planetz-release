import {
  type KiroSpecSummary,
  listKiroFeaturesNeedingApproval,
  resolveKiroPhaseReason,
  resolveKiroRoutingContextFromSpecs,
  resolveKiroRoutingPhase,
  resolvePrimaryKiroFeature,
  resolveSddRecommendedEntry,
  type SddOpenSnapshot,
} from '@planetz/shared'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-store.js'
import type { KiroSpecStore } from './kiro-spec-store.js'
import type { SpecApprovalIngestService } from './spec-approval-ingest-service.js'

export type BuildSddOpenSnapshotResult = {
  snapshot: SddOpenSnapshot
  approvalIngestCount: number
}

export async function buildSddOpenSnapshot(input: {
  workspacePath: string
  sidecarPaths: SidecarPaths
  intentLedgerStore: IntentLedgerStore
  kiroSpecStore: KiroSpecStore
  specApprovalIngest?: SpecApprovalIngestService
  /** When set, avoids a second listSpecs during the same refresh cycle. */
  specs?: KiroSpecSummary[]
}): Promise<BuildSddOpenSnapshotResult> {
  const specs = input.specs ?? (await input.kiroSpecStore.listSpecs(input.workspacePath))

  let approvalIngestCount = 0
  if (input.specApprovalIngest) {
    approvalIngestCount = await input.specApprovalIngest
      .sync(input.workspacePath, input.sidecarPaths, specs)
      .catch((error) => {
        console.warn('[planetz] kiro spec approval ingest skipped', error)
        return 0
      })
  }

  const summary = await input.intentLedgerStore.aggregateSummary(input.sidecarPaths, {
    window: 'all',
  })
  const featuresNeedingApproval = listKiroFeaturesNeedingApproval(specs)
  const primary = resolvePrimaryKiroFeature(specs)
  const kiroPhase = resolveKiroRoutingPhase(primary)
  const kiroCtx = resolveKiroRoutingContextFromSpecs(specs)

  return {
    snapshot: {
      intentLedgerPendingCount: summary.pendingCount,
      intentLedgerUnanchoredCount: summary.unanchoredCount,
      kiroSpecCount: specs.length,
      featuresNeedingApproval,
      recommendedEntry: resolveSddRecommendedEntry({
        pendingCount: summary.pendingCount,
        unanchoredCount: summary.unanchoredCount,
        featuresNeedingApproval,
        kiroPhase,
      }),
      ...(kiroCtx
        ? {
            kiroPhase: kiroCtx.kiroPhase,
            specFeatureId: kiroCtx.specFeatureId,
            phaseReason: kiroCtx.phaseReason,
          }
        : primary
          ? {
              kiroPhase,
              specFeatureId: primary.featureId,
              phaseReason: resolveKiroPhaseReason(kiroPhase, primary.featureId),
            }
          : {}),
    },
    approvalIngestCount,
  }
}
