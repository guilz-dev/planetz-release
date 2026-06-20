import type { TaskRoutingRequirements } from '@planetz/shared'
import type { StructureRoutingCandidate } from './candidate-builder.js'

/** Investigation- or report-first tasks that should not default to implementation-heavy workflows. */
function shouldPreferReadFriendlyFallback(requirements: TaskRoutingRequirements): boolean {
  const intent = requirements.intent ?? []
  const expectedOutput = requirements.expectedOutput ?? []
  if (!intent.includes('investigate')) return false
  if (!expectedOutput.includes('report')) return false
  return (
    requirements.needsRootCauseAnalysis ||
    requirements.needsDeepReview ||
    !requirements.implementationAlreadyDecided
  )
}

function fallbackFitness(
  requirements: TaskRoutingRequirements,
  candidate: StructureRoutingCandidate,
): number {
  const { features } = candidate
  let fitness = candidate.score

  if (shouldPreferReadFriendlyFallback(requirements)) {
    if (features.forcesImplementationOnAllPaths) fitness -= 0.35
    if (features.changeMode === 'edit_heavy') fitness -= 0.25
    if (
      features.changeMode === 'edit_heavy' &&
      !features.canCompleteWithoutEditing &&
      features.hasImplementationPath
    ) {
      fitness -= 0.15
    }
    if (features.canCompleteWithoutEditing) fitness += 0.15
    else if (features.canCompleteBeforeFirstEdit) fitness += 0.08
    if (features.dominantModes?.includes('investigate')) fitness += 0.1
    if (
      features.investigateStepCount > 0 &&
      features.investigateStepCount >= features.editStepCount
    ) {
      fitness += 0.08
    }
    if (candidate.group === 'research' || candidate.group === 'bugfix') fitness += 0.05
    const surfaces = requirements.targetSurfaces ?? []
    if (candidate.group === 'ops' && !surfaces.includes('infra')) {
      fitness -= 0.2
    }
  }

  return fitness
}

/** Picks a structure-fit fallback when LLM final selection is unavailable. */
export function pickPreferredFallbackCandidate(
  requirements: TaskRoutingRequirements,
  viable: StructureRoutingCandidate[],
): string | undefined {
  if (viable.length === 0) return undefined
  if (!shouldPreferReadFriendlyFallback(requirements)) {
    return viable[0]?.workflowName
  }

  const ranked = [...viable].sort(
    (a, b) => fallbackFitness(requirements, b) - fallbackFitness(requirements, a),
  )
  return ranked[0]?.workflowName ?? viable[0]?.workflowName
}
