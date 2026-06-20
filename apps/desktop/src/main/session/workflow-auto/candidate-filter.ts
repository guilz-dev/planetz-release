import {
  kiroPhaseBlocksImplementation,
  ROUTING_REASON_CODES,
  type TaskRoutingRequirements,
  type WorkflowRoutingEntry,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import { estimateRoutingTaskComplexity } from './routing-complexity.js'

export type RoutingCatalogMetadata = Map<string, Pick<WorkflowRoutingEntry, 'complexityBand'>>

export type FilteredRoutingCandidate = {
  workflowName: string
  features: WorkflowStructureFeatures
  rejected: boolean
  rejectReasons: string[]
  softPenalty: number
}

function isCodeHeavyPrimary(features: WorkflowStructureFeatures): boolean {
  const outputs = features.primaryOutputs
  const codeLike = outputs.includes('code') || outputs.includes('tests')
  const reportOnly = outputs.length === 1 && outputs[0] === 'report'
  return codeLike && !reportOnly
}

function hasWeakReviewAuditFeatures(features: WorkflowStructureFeatures): boolean {
  const modes = new Set(features.dominantModes)
  return !modes.has('review') && !modes.has('audit') && features.reviewStepCount === 0
}

function workflowComplexityBand(
  catalogMetadata: RoutingCatalogMetadata | undefined,
  workflowName: string,
): 'low' | 'medium' | 'high' {
  return catalogMetadata?.get(workflowName)?.complexityBand ?? 'medium'
}

export function filterRoutingCandidates(
  requirements: TaskRoutingRequirements,
  featuresByName: Map<string, WorkflowStructureFeatures>,
  catalogMetadata?: RoutingCatalogMetadata,
): FilteredRoutingCandidate[] {
  const expectedOutput = requirements.expectedOutput ?? []
  const intent = requirements.intent ?? []
  const taskComplexity = estimateRoutingTaskComplexity(requirements)
  const results: FilteredRoutingCandidate[] = []

  for (const [workflowName, features] of featuresByName) {
    const rejectReasons: string[] = []
    let softPenalty = 1

    if (!requirements.implementationAlreadyDecided && features.forcesImplementationOnAllPaths) {
      rejectReasons.push(ROUTING_REASON_CODES.reject.forcesImplementationOnAllPaths)
    }

    const kiroPhase = requirements.kiroRouting?.kiroPhase
    if (kiroPhase && kiroPhaseBlocksImplementation(kiroPhase)) {
      const blocksImpl =
        features.forcesImplementationOnAllPaths ||
        (features.hasImplementationPath &&
          (features.changeMode === 'edit_heavy' || features.changeMode === 'mixed'))
      if (blocksImpl) {
        rejectReasons.push(ROUTING_REASON_CODES.reject.kiroPhaseBlocksImplementation)
      }
    }

    if (!requirements.mayModifyCode && features.changeMode === 'edit_heavy') {
      rejectReasons.push(ROUTING_REASON_CODES.reject.editHeavyReadOnly)
    }

    if (
      expectedOutput.includes('report') &&
      !features.canCompleteWithoutEditing &&
      isCodeHeavyPrimary(features)
    ) {
      rejectReasons.push(ROUTING_REASON_CODES.reject.reportOutputMismatch)
    }

    const wantsReview = intent.includes('review')
    const wantsAudit = intent.includes('audit')
    if ((wantsReview || wantsAudit) && hasWeakReviewAuditFeatures(features)) {
      rejectReasons.push(ROUTING_REASON_CODES.reject.weakReviewAuditFeatures)
    }

    if (requirements.needsTestWriting && !features.hasWriteTestsStep) {
      softPenalty *= 0.85
    }

    const taskSurfaces = new Set(requirements.targetSurfaces)
    const featureSurfaces = new Set(features.targetSurfaces)
    const surfaceOverlap = [...taskSurfaces].some(
      (s) => featureSurfaces.has(s) || featureSurfaces.has('general'),
    )
    if (!surfaceOverlap) softPenalty *= 0.9

    if (!requirements.mayModifyCode && features.changeMode === 'mixed') {
      softPenalty *= 0.92
    }

    if (requirements.needsDeepReview && !features.hasReviewLoop && !features.hasParallelReview) {
      softPenalty *= 0.88
    }

    if (requirements.ambiguity === 'high' && features.requiresClearSpec) {
      softPenalty *= 0.9
    }

    const band = workflowComplexityBand(catalogMetadata, workflowName)
    if (band === 'high' && taskComplexity === 'low') {
      rejectReasons.push(ROUTING_REASON_CODES.reject.highComplexityBandForSimpleTask)
    }

    results.push({
      workflowName,
      features,
      rejected: rejectReasons.length > 0,
      rejectReasons,
      softPenalty,
    })
  }

  return results
}
