import type { AutoWorkflowDecision, RoutingGroup, WorkflowRoutingCatalog } from '@planetz/shared'

function filterExcluded(names: readonly string[], excluded?: ReadonlySet<string>): string[] {
  if (!excluded || excluded.size === 0) return [...names]
  return names.filter((name) => !excluded.has(name))
}

export { filterExcluded }

export function resolveFallbackWorkflow(
  catalog: WorkflowRoutingCatalog,
  availableWorkflowNames: string[],
  excludedWorkflowNames?: ReadonlySet<string>,
): string | null {
  const available = filterExcluded(availableWorkflowNames, excludedWorkflowNames).sort((a, b) =>
    a.localeCompare(b),
  )
  if (available.length === 0) return null
  if (available.includes('default')) return 'default'

  const generalNames = catalog.workflows
    .filter(
      (entry) =>
        entry.enabledForAuto &&
        entry.routingGroups.includes('general') &&
        available.includes(entry.name),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
  if (generalNames[0]) return generalNames[0]

  return available[0] ?? null
}

/** Returns a workflow name that is not in `excludedWorkflowNames`, or null when none exists. */
export function resolveSafeFallbackWorkflowName(input: {
  catalog: WorkflowRoutingCatalog
  availableWorkflowNames: string[]
  excludedWorkflowNames?: ReadonlySet<string>
  preferredWorkflow?: string
}): string | null {
  const excluded = input.excludedWorkflowNames ?? new Set<string>()

  const pickIfAllowed = (name?: string | null): string | null =>
    name && !excluded.has(name) ? name : null

  const preferred = pickIfAllowed(input.preferredWorkflow?.trim())
  if (preferred) return preferred

  const resolved = resolveFallbackWorkflow(input.catalog, input.availableWorkflowNames, excluded)
  if (resolved) return resolved

  const allowedEnabled = filterExcluded(
    input.catalog.workflows.filter((entry) => entry.enabledForAuto).map((entry) => entry.name),
    excluded,
  ).sort((a, b) => a.localeCompare(b))
  if (allowedEnabled[0]) return allowedEnabled[0]

  return pickIfAllowed('default')
}

export function resolveRoutingGroupForWorkflow(
  catalog: WorkflowRoutingCatalog,
  workflowName: string,
): RoutingGroup {
  const entry = catalog.workflows.find((item) => item.name === workflowName)
  return entry?.routingGroups[0] ?? 'general'
}

export function buildFallbackDecision(
  workflow: string,
  reasonCodes: string[],
  catalog?: WorkflowRoutingCatalog,
): Pick<
  AutoWorkflowDecision,
  | 'selectedWorkflow'
  | 'group'
  | 'confidence'
  | 'score'
  | 'fallbackApplied'
  | 'alternatives'
  | 'reasonCodes'
> {
  return {
    selectedWorkflow: workflow,
    group: catalog ? resolveRoutingGroupForWorkflow(catalog, workflow) : 'general',
    confidence: 'low',
    score: 0,
    fallbackApplied: true,
    alternatives: [],
    reasonCodes: [...reasonCodes, 'fallback:applied'],
  }
}
