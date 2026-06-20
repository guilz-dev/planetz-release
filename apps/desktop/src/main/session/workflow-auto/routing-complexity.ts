import {
  ROUTING_REASON_CODES,
  type TaskRoutingRequirements,
  WORKFLOW_ROUTING_COMPLEXITY_SCORE_TIE_THRESHOLD,
  WORKFLOW_ROUTING_COMPLEXITY_STEP_RATIO_THRESHOLD,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import type { ScoredRoutingCandidate } from './candidate-score.js'

export type RoutingTaskComplexity = 'low' | 'medium' | 'high'

/** Heuristic task complexity from routing requirements (no LLM). */
export function estimateRoutingTaskComplexity(
  requirements: TaskRoutingRequirements,
): RoutingTaskComplexity {
  let signals = 0
  if (requirements.intent.length > 1) signals += 2
  if (requirements.expectedOutput.length > 1) signals += 1
  if (requirements.needsDeepReview) signals += 2
  if (requirements.needsTestWriting) signals += 1
  if (requirements.needsRootCauseAnalysis) signals += 1
  if (requirements.ambiguity === 'high') signals += 2
  else if (requirements.ambiguity === 'medium') signals += 1
  if (requirements.blockingUnknowns.length > 0) signals += 1

  if (signals <= 1) return 'low'
  if (signals >= 4) return 'high'
  return 'medium'
}

/** Relative workflow weight for complexity rerank (lower is lighter). */
export function estimateWorkflowComplexityWeight(features: WorkflowStructureFeatures): number {
  let weight = features.stepCount
  weight += features.editStepCount * 0.5
  if (features.hasReviewLoop) weight += 2
  if (features.hasFixLoop) weight += 2
  if (features.hasParallelReview) weight += 2
  return weight
}

function stepCountRatio(a: WorkflowStructureFeatures, b: WorkflowStructureFeatures): number {
  const minSteps = Math.min(a.stepCount, b.stepCount)
  const maxSteps = Math.max(a.stepCount, b.stepCount)
  if (maxSteps === 0) return 1
  return minSteps > 0 ? maxSteps / minSteps : maxSteps
}

function compareByScoreThenName(a: ScoredRoutingCandidate, b: ScoredRoutingCandidate): number {
  if (b.score !== a.score) return b.score - a.score
  return a.workflowName.localeCompare(b.workflowName)
}

function shouldPreferLightweightAmongPeers(
  lightest: WorkflowStructureFeatures,
  heaviest: WorkflowStructureFeatures,
): boolean {
  return (
    stepCountRatio(lightest, heaviest) >= WORKFLOW_ROUTING_COMPLEXITY_STEP_RATIO_THRESHOLD &&
    estimateWorkflowComplexityWeight(lightest) !== estimateWorkflowComplexityWeight(heaviest)
  )
}

/** Reorder close-scoring viable peers so the lightest workflow leads (low-complexity tasks). */
export function rerankLowComplexityViable(
  viable: ScoredRoutingCandidate[],
): ScoredRoutingCandidate[] {
  if (viable.length < 2) return [...viable]

  const byScore = [...viable].sort(compareByScoreThenName)
  const topScore = byScore[0]?.score ?? 0
  const closePeers = byScore.filter(
    (c) => topScore - c.score <= WORKFLOW_ROUTING_COMPLEXITY_SCORE_TIE_THRESHOLD,
  )
  if (closePeers.length < 2) return byScore

  const lightest = [...closePeers].sort(
    (a, b) =>
      estimateWorkflowComplexityWeight(a.features) - estimateWorkflowComplexityWeight(b.features),
  )[0]
  const heaviest = [...closePeers].sort(
    (a, b) =>
      estimateWorkflowComplexityWeight(b.features) - estimateWorkflowComplexityWeight(a.features),
  )[0]
  if (
    !lightest ||
    !heaviest ||
    !shouldPreferLightweightAmongPeers(lightest.features, heaviest.features)
  ) {
    return byScore
  }

  const closeNames = new Set(closePeers.map((c) => c.workflowName))
  const reorderedClose = [...closePeers].sort((a, b) => {
    const weightDiff =
      estimateWorkflowComplexityWeight(a.features) - estimateWorkflowComplexityWeight(b.features)
    if (weightDiff !== 0) return weightDiff
    return a.workflowName.localeCompare(b.workflowName)
  })
  const rest = byScore.filter((c) => !closeNames.has(c.workflowName))
  return [...reorderedClose, ...rest]
}

/** Compare viable candidates; may prefer lighter workflow on simple tasks when scores are close. */
export function compareRoutingCandidatesByComplexity(
  taskComplexity: RoutingTaskComplexity,
  a: ScoredRoutingCandidate,
  b: ScoredRoutingCandidate,
): number {
  if (a.rejected !== b.rejected) return a.rejected ? 1 : -1

  const scoreDiff = Math.abs(a.score - b.score)
  if (
    taskComplexity === 'low' &&
    scoreDiff <= WORKFLOW_ROUTING_COMPLEXITY_SCORE_TIE_THRESHOLD &&
    stepCountRatio(a.features, b.features) >= WORKFLOW_ROUTING_COMPLEXITY_STEP_RATIO_THRESHOLD &&
    estimateWorkflowComplexityWeight(a.features) !== estimateWorkflowComplexityWeight(b.features)
  ) {
    return (
      estimateWorkflowComplexityWeight(a.features) - estimateWorkflowComplexityWeight(b.features)
    )
  }

  return compareByScoreThenName(a, b)
}

/** Tag top-ranked candidate when complexity rerank promoted a lighter peer. */
export function tagComplexityPreferLightweight(
  taskComplexity: RoutingTaskComplexity,
  ranked: ScoredRoutingCandidate[],
): ScoredRoutingCandidate[] {
  if (taskComplexity !== 'low') return ranked

  const viable = ranked.filter((c) => !c.rejected)
  if (viable.length < 2) return ranked

  const byScore = [...viable].sort(compareByScoreThenName)
  const topScore = byScore[0]?.score ?? 0
  const closePeers = byScore.filter(
    (c) => topScore - c.score <= WORKFLOW_ROUTING_COMPLEXITY_SCORE_TIE_THRESHOLD,
  )
  if (closePeers.length < 2) return ranked

  const lightest = [...closePeers].sort(
    (a, b) =>
      estimateWorkflowComplexityWeight(a.features) - estimateWorkflowComplexityWeight(b.features),
  )[0]
  const heaviest = [...closePeers].sort(
    (a, b) =>
      estimateWorkflowComplexityWeight(b.features) - estimateWorkflowComplexityWeight(a.features),
  )[0]
  if (
    !lightest ||
    !heaviest ||
    !shouldPreferLightweightAmongPeers(lightest.features, heaviest.features)
  ) {
    return ranked
  }

  if (ranked[0]?.workflowName !== lightest.workflowName) return ranked

  return ranked.map((candidate) =>
    candidate.workflowName === lightest.workflowName
      ? {
          ...candidate,
          matchedFeatures: [
            ...candidate.matchedFeatures,
            ROUTING_REASON_CODES.match.complexityPreferLightweight,
          ],
        }
      : candidate,
  )
}

export function sortRoutingCandidatesByComplexity(
  requirements: TaskRoutingRequirements,
  scored: ScoredRoutingCandidate[],
): ScoredRoutingCandidate[] {
  const taskComplexity = estimateRoutingTaskComplexity(requirements)
  const rejected = scored.filter((c) => c.rejected)
  const viable = scored.filter((c) => !c.rejected)

  const orderedViable =
    taskComplexity === 'low'
      ? rerankLowComplexityViable(viable)
      : [...viable].sort(compareByScoreThenName)

  const ranked = [...orderedViable, ...rejected]
  return tagComplexityPreferLightweight(taskComplexity, ranked)
}
