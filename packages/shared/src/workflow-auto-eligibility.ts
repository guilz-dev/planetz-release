import { getBuiltinWorkflowTierMeta } from './builtin-workflow-tier.js'
import type { WorkflowSource } from './types.js'
import type {
  WorkflowRoutingCatalog,
  WorkflowRoutingEntry,
} from './workflow-auto-routing-schema.js'
import type { WorkflowLibraryUiPrefs } from './workflow-library-ui.js'

export function isRuntimeAutoEligible(
  name: string,
  source: WorkflowSource | undefined,
  catalogEntry: WorkflowRoutingEntry | undefined,
  uiPrefs: WorkflowLibraryUiPrefs,
): boolean {
  if (!catalogEntry) return false
  const explicitlyEnabledByUi = uiPrefs.autoEnabledWorkflows.includes(name.trim())
  if (source !== 'builtin') {
    return catalogEntry.enabledForAuto || explicitlyEnabledByUi
  }

  const meta = getBuiltinWorkflowTierMeta(name)
  if (meta.lifecycle === 'deprecated') {
    return false
  }
  if (meta.tier === 'core') {
    return catalogEntry.enabledForAuto
  }
  if (meta.tier === 'system') {
    return false
  }
  return explicitlyEnabledByUi
}

export function listRuntimeAutoEligibleNames(input: {
  catalog: WorkflowRoutingCatalog
  availableWorkflowNames: string[]
  workflowsByName: ReadonlyMap<string, WorkflowSource>
  uiPrefs: WorkflowLibraryUiPrefs
}): string[] {
  const available = new Set(input.availableWorkflowNames)
  const catalogByName = new Map(input.catalog.workflows.map((entry) => [entry.name, entry]))
  const out: string[] = []
  for (const name of input.availableWorkflowNames) {
    if (!available.has(name)) continue
    const entry = catalogByName.get(name)
    const source = input.workflowsByName.get(name)
    if (isRuntimeAutoEligible(name, source, entry, input.uiPrefs)) {
      out.push(name)
    }
  }
  return out
}

export function listRuntimeAutoEligibleEntries(input: {
  catalog: WorkflowRoutingCatalog
  availableWorkflowNames: string[]
  workflowsByName: ReadonlyMap<string, WorkflowSource>
  uiPrefs: WorkflowLibraryUiPrefs
}): WorkflowRoutingEntry[] {
  const names = new Set(listRuntimeAutoEligibleNames(input))
  return input.catalog.workflows.filter((entry) => names.has(entry.name))
}
