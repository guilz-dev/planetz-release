import {
  getBuiltinWorkflowTierMeta,
  type WorkflowRoutingCatalog,
  type WorkflowRoutingEntry,
  type WorkflowSource,
  type WorkflowSummary,
} from '@planetz/shared'
import type { WorkflowRoutingCatalogStore } from './workflow-routing-catalog.js'
import { buildRoutingCatalogEntry } from './workflow-routing-catalog-entry.js'
import { routingGroupsForWorkflow } from './workflow-routing-category-map.js'
import { applyRoutingMetadataToEntry } from './workflow-routing-metadata.js'

export type WorkflowRoutingMergeInput =
  | string
  | (Pick<WorkflowSummary, 'name' | 'categories'> & { source?: WorkflowSource })

function normalizeMergeInput(input: WorkflowRoutingMergeInput): {
  name: string
  categories?: string[]
  source?: WorkflowSource
} {
  if (typeof input === 'string') {
    return { name: input.trim() }
  }
  return { name: input.name.trim(), categories: input.categories, source: input.source }
}

function routingEntryMetadataEquals(a: WorkflowRoutingEntry, b: WorkflowRoutingEntry): boolean {
  return (
    a.routingGroups.join('\0') === b.routingGroups.join('\0') &&
    a.complexityBand === b.complexityBand &&
    a.safetyTier === b.safetyTier
  )
}

/** Appends catalog entries for workflow names not yet registered (never overwrites). */
export async function mergeNewWorkflowsIntoRoutingCatalog(
  store: WorkflowRoutingCatalogStore,
  workflows: WorkflowRoutingMergeInput[],
): Promise<boolean> {
  if (workflows.length === 0) return false
  const catalog = await store.load()
  const existing = new Set(catalog.workflows.map((entry) => entry.name))
  const additions = workflows
    .map(normalizeMergeInput)
    .filter((entry) => entry.name.length > 0 && !existing.has(entry.name))
  if (additions.length === 0) return false

  const next: WorkflowRoutingCatalog = {
    ...catalog,
    workflows: [...catalog.workflows, ...additions.map(buildRoutingCatalogEntry)],
  }
  await store.write(next)
  return true
}

/** Upgrades catalog rows still on general-only when name/category metadata implies a specific group. */
export async function reconcileRoutingGroupsInCatalog(
  store: WorkflowRoutingCatalogStore,
  workflows: WorkflowRoutingMergeInput[],
): Promise<boolean> {
  if (workflows.length === 0) return false
  const catalog = await store.load()
  const metadataByName = new Map(
    workflows.map(normalizeMergeInput).map((entry) => [entry.name, entry]),
  )

  let changed = false
  const nextWorkflows = catalog.workflows.map((entry) => {
    const metadata = metadataByName.get(entry.name)
    if (!metadata) return entry

    const inferred = routingGroupsForWorkflow(entry.name, metadata.categories)
    const stuckOnGeneral = entry.routingGroups.length === 1 && entry.routingGroups[0] === 'general'
    const inferredSpecific = !(inferred.length === 1 && inferred[0] === 'general')
    if (!stuckOnGeneral || !inferredSpecific) return entry

    changed = true
    return { ...entry, routingGroups: inferred }
  })

  if (!changed) return false
  await store.write({ ...catalog, workflows: nextWorkflows })
  return true
}

/** Fills routing metadata (complexityBand, safetyTier, groups) on catalog rows when known. */
export async function reconcileRoutingMetadataInCatalog(
  store: WorkflowRoutingCatalogStore,
): Promise<boolean> {
  const catalog = await store.load()
  let changed = false
  const nextWorkflows = catalog.workflows.map((entry) => {
    const next = applyRoutingMetadataToEntry(entry)
    if (routingEntryMetadataEquals(next, entry)) return entry
    changed = true
    return next
  })
  if (!changed) return false
  await store.write({ ...catalog, workflows: nextWorkflows })
  return true
}

/** Downgrades library/system builtin auto flags and promotes core; never touches project/user rows. */
export async function reconcileBuiltinAutoEligibilityInCatalog(
  store: WorkflowRoutingCatalogStore,
  workflows: WorkflowRoutingMergeInput[],
): Promise<boolean> {
  if (workflows.length === 0) return false
  const sourceByName = new Map(
    workflows.map(normalizeMergeInput).map((entry) => [entry.name, entry.source]),
  )
  const catalog = await store.load()
  let changed = false
  const nextWorkflows = catalog.workflows.map((entry) => {
    if (sourceByName.get(entry.name) !== 'builtin') return entry
    const tier = getBuiltinWorkflowTierMeta(entry.name).tier
    if (tier === 'core') {
      if (entry.enabledForAuto) return entry
      changed = true
      return { ...entry, enabledForAuto: true }
    }
    if (tier === 'library' || tier === 'system') {
      if (!entry.enabledForAuto) return entry
      changed = true
      return { ...entry, enabledForAuto: false }
    }
    return entry
  })
  if (!changed) return false
  await store.write({ ...catalog, workflows: nextWorkflows })
  return true
}
