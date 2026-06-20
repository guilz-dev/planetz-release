import {
  kiroSpecPhaseScoreBoost,
  ROUTING_REASON_CODES,
  type TaskRoutingRequirements,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import type { FilteredRoutingCandidate } from './candidate-filter.js'
import { sortRoutingCandidatesByComplexity } from './routing-complexity.js'

export type ScoredRoutingCandidate = FilteredRoutingCandidate & {
  score: number
  matchedFeatures: string[]
}

function surfaceMatch(
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  const task = new Set(requirements.targetSurfaces)
  const wf = new Set(features.targetSurfaces)
  if (wf.has('general')) return 0.7
  let hits = 0
  for (const s of task) {
    if (wf.has(s)) hits += 1
  }
  return task.size === 0 ? 0.5 : hits / task.size
}

function intentMatch(
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  if (requirements.intent.length === 0) return 0.5
  const wfModes = new Set(features.dominantModes)
  let hits = 0
  for (const intent of requirements.intent) {
    if (wfModes.has(intent)) hits += 1
  }
  return hits / requirements.intent.length
}

function outputMatch(
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  if (requirements.expectedOutput.length === 0) return 0.5
  const outputs = new Set(features.primaryOutputs)
  let hits = 0
  for (const expected of requirements.expectedOutput) {
    if (outputs.has(expected)) hits += 1
  }
  return hits / requirements.expectedOutput.length
}

function changeModeMatch(
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  if (!requirements.mayModifyCode) {
    if (features.changeMode === 'read_only') return 1
    if (features.changeMode === 'mixed') return 0.6
    return 0.2
  }
  if (requirements.intent.includes('implement')) {
    if (features.changeMode === 'edit_heavy') return 1
    if (features.changeMode === 'mixed') return 0.7
    return 0.3
  }
  return 0.6
}

function structureFit(
  requirements: TaskRoutingRequirements,
  features: WorkflowStructureFeatures,
): number {
  let score = 0.5
  const investigate = requirements.intent.includes('investigate')
  const implement = requirements.intent.includes('implement')
  const review = requirements.intent.includes('review') || requirements.intent.includes('audit')

  if (investigate && features.canCompleteWithoutEditing) score += 0.25
  else if (investigate && features.canCompleteBeforeFirstEdit) score += 0.12
  if (implement && features.hasImplementationPath && features.hasWriteTestsStep) score += 0.2
  if (review && features.canCompleteWithoutEditing && features.hasReviewLoop) score += 0.2
  else if (review && features.canCompleteBeforeFirstEdit && features.hasReviewLoop) score += 0.1
  if (!requirements.implementationAlreadyDecided && !features.forcesImplementationOnAllPaths) {
    score += 0.15
  }
  return Math.min(1, score)
}

export function scoreRoutingCandidates(
  requirements: TaskRoutingRequirements,
  filtered: FilteredRoutingCandidate[],
): ScoredRoutingCandidate[] {
  const normalized: TaskRoutingRequirements = {
    ...requirements,
    intent: requirements.intent ?? [],
    expectedOutput: requirements.expectedOutput ?? [],
    targetSurfaces: requirements.targetSurfaces ?? ['general'],
  }
  const scored: ScoredRoutingCandidate[] = []

  for (const candidate of filtered) {
    if (candidate.rejected) {
      scored.push({ ...candidate, score: 0, matchedFeatures: [] })
      continue
    }

    const { features } = candidate
    const fit = structureFit(normalized, features)
    const rawScore =
      surfaceMatch(normalized, features) * 0.25 +
      intentMatch(normalized, features) * 0.25 +
      outputMatch(normalized, features) * 0.2 +
      changeModeMatch(normalized, features) * 0.15 +
      fit * 0.15

    const kiroPhase = normalized.kiroRouting?.kiroPhase
    const kiroPhaseBoost =
      kiroPhase != null ? kiroSpecPhaseScoreBoost(kiroPhase, normalized, features) : 1
    const kiroSpecPhaseMatch = kiroPhaseBoost > 1

    let score = rawScore * candidate.softPenalty
    if (kiroPhaseBoost > 1) {
      score = Math.min(1, score * kiroPhaseBoost)
    }

    const matchedFeatures: string[] = []
    if (fit > 0.6) matchedFeatures.push('match:structure-fit')
    if (features.canCompleteWithoutEditing) matchedFeatures.push('match:report-only-completion')
    else if (features.canCompleteBeforeFirstEdit && normalized.expectedOutput.includes('report')) {
      matchedFeatures.push('match:report-before-edit-completion')
    }
    if (kiroSpecPhaseMatch) {
      matchedFeatures.push(ROUTING_REASON_CODES.match.kiroSpecPhase)
    }

    scored.push({ ...candidate, score, matchedFeatures })
  }

  return sortRoutingCandidatesByComplexity(normalized, scored)
}
