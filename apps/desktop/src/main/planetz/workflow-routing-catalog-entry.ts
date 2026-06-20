import {
  getBuiltinWorkflowTierMeta,
  type WorkflowRoutingEntry,
  type WorkflowSource,
} from '@planetz/shared'
import { routingGroupsForWorkflow } from './workflow-routing-category-map.js'
import { applyRoutingMetadataToEntry } from './workflow-routing-metadata.js'

const DEFAULT_ROUTING_COMPLEXITY_BAND = 'medium' as const
const DEFAULT_ROUTING_SAFETY_TIER = 'safe' as const

function seedEnabledForAuto(name: string, source?: WorkflowSource): boolean {
  if (source === 'builtin') {
    return getBuiltinWorkflowTierMeta(name).autoPolicy === 'always'
  }
  return false
}

/** Builds a routing catalog row with name/category inference and known workflow metadata overlays. */
export function buildRoutingCatalogEntry(input: {
  name: string
  categories?: string[]
  source?: WorkflowSource
}): WorkflowRoutingEntry {
  return applyRoutingMetadataToEntry({
    name: input.name,
    enabledForAuto: seedEnabledForAuto(input.name, input.source),
    routingGroups: routingGroupsForWorkflow(input.name, input.categories),
    keywords: { include: [], exclude: [] },
    complexityBand: DEFAULT_ROUTING_COMPLEXITY_BAND,
    safetyTier: DEFAULT_ROUTING_SAFETY_TIER,
  })
}
