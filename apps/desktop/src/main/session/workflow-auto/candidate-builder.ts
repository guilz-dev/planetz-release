import {
  ROUTING_REASON_CODES,
  type RoutingGroup,
  type TaskRoutingRequirements,
  type WorkflowRoutingCatalog,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import type { FilteredRoutingCandidate } from './candidate-filter.js'
import { filterRoutingCandidates } from './candidate-filter.js'
import { type ScoredRoutingCandidate, scoreRoutingCandidates } from './candidate-score.js'
import {
  listEnabledAutoWorkflowEntries,
  type RuntimeAutoWorkflowFilter,
} from './enabled-workflows.js'
import { createUnavailableWorkflowFeatures } from './unavailable-workflow-features.js'

function featuresUnavailableCandidate(workflowName: string): FilteredRoutingCandidate {
  return {
    workflowName,
    features: createUnavailableWorkflowFeatures(workflowName),
    rejected: true,
    rejectReasons: [ROUTING_REASON_CODES.reject.featuresUnavailable],
    softPenalty: 0,
  }
}

export type StructureRoutingCandidate = ScoredRoutingCandidate & {
  group: RoutingGroup
  routingGroups: RoutingGroup[]
  complexityBand?: 'low' | 'medium' | 'high'
  safetyTier?: 'safe' | 'strict'
}

export function buildScoredRoutingCandidates(input: {
  catalog: WorkflowRoutingCatalog
  featuresByName: Map<string, WorkflowStructureFeatures>
  requirements: TaskRoutingRequirements
  availableWorkflowNames: string[]
  runtimeAutoFilter?: RuntimeAutoWorkflowFilter
}): StructureRoutingCandidate[] {
  const enabledEntries = listEnabledAutoWorkflowEntries(
    input.catalog,
    input.availableWorkflowNames,
    input.runtimeAutoFilter,
  )
  const enabledFeatures = new Map<string, WorkflowStructureFeatures>()
  for (const entry of enabledEntries) {
    const features = input.featuresByName.get(entry.name)
    if (features) enabledFeatures.set(entry.name, features)
  }

  const catalogMetadata = new Map(
    input.catalog.workflows.map((entry) => [entry.name, { complexityBand: entry.complexityBand }]),
  )
  const filtered = filterRoutingCandidates(input.requirements, enabledFeatures, catalogMetadata)
  const scored = scoreRoutingCandidates(input.requirements, filtered)
  const scoredNames = new Set(scored.map((c) => c.workflowName))
  const unavailable: ScoredRoutingCandidate[] = []
  for (const entry of enabledEntries) {
    if (input.featuresByName.has(entry.name) || scoredNames.has(entry.name)) continue
    unavailable.push({
      ...featuresUnavailableCandidate(entry.name),
      score: 0,
      matchedFeatures: [],
    })
  }
  const byName = new Map(input.catalog.workflows.map((e) => [e.name, e]))

  return [...scored, ...unavailable].map((candidate) => {
    const entry = byName.get(candidate.workflowName)
    const routingGroups = entry?.routingGroups ?? ['general']
    return {
      ...candidate,
      group: routingGroups[0] ?? 'general',
      routingGroups,
      ...(entry?.complexityBand ? { complexityBand: entry.complexityBand } : {}),
      ...(entry?.safetyTier ? { safetyTier: entry.safetyTier } : {}),
    }
  })
}

export type { ScoredRoutingCandidate }
