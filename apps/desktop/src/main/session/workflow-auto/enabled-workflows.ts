import {
  listRuntimeAutoEligibleEntries,
  listRuntimeAutoEligibleNames,
  type WorkflowLibraryUiPrefs,
  type WorkflowRoutingCatalog,
  type WorkflowRoutingEntry,
  type WorkflowSource,
} from '@planetz/shared'

export type RuntimeAutoWorkflowFilter = {
  workflowsByName: ReadonlyMap<string, WorkflowSource>
  uiPrefs: WorkflowLibraryUiPrefs
}

export function listEnabledAutoWorkflowEntries(
  catalog: WorkflowRoutingCatalog,
  availableWorkflowNames: string[],
  filter?: RuntimeAutoWorkflowFilter,
): WorkflowRoutingEntry[] {
  if (!filter) {
    const available = new Set(availableWorkflowNames)
    return catalog.workflows.filter((entry) => entry.enabledForAuto && available.has(entry.name))
  }
  return listRuntimeAutoEligibleEntries({
    catalog,
    availableWorkflowNames,
    workflowsByName: filter.workflowsByName,
    uiPrefs: filter.uiPrefs,
  })
}

export function listEnabledAutoWorkflowNames(
  catalog: WorkflowRoutingCatalog,
  availableWorkflowNames: string[],
  filter?: RuntimeAutoWorkflowFilter,
): string[] {
  if (!filter) {
    const available = new Set(availableWorkflowNames)
    return catalog.workflows
      .filter((entry) => entry.enabledForAuto && available.has(entry.name))
      .map((entry) => entry.name)
  }
  return listRuntimeAutoEligibleNames({
    catalog,
    availableWorkflowNames,
    workflowsByName: filter.workflowsByName,
    uiPrefs: filter.uiPrefs,
  })
}
