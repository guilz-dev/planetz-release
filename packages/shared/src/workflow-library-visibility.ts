import { getLibraryPackId } from './builtin-workflow-tier.js'
import type { WorkflowSummary } from './types.js'
import { isDeprecatedBuiltinWorkflow } from './workflow-enable-guards.js'
import type { WorkflowLibraryUiPrefs } from './workflow-library-ui.js'

export function isExplicitlyEnabledLibraryWorkflow(
  name: string,
  prefs: WorkflowLibraryUiPrefs,
): boolean {
  const trimmed = name.trim()
  if (prefs.enabledWorkflows.includes(trimmed)) return true
  const packId = getLibraryPackId(trimmed)
  if (packId === undefined || !prefs.enabledPacks.includes(packId)) return false
  return !isDeprecatedBuiltinWorkflow(trimmed)
}

export function isImplicitEnabledLibraryWorkflow(
  name: string,
  prefs: WorkflowLibraryUiPrefs,
): boolean {
  const trimmed = name.trim()
  return (
    prefs.implicitEnabledWorkflows.includes(trimmed) &&
    !prefs.dismissedImplicitWorkflows.includes(trimmed)
  )
}

/** Implicit enable badge: visible in picker from past use, not explicitly enabled. */
export function shouldShowImplicitEnableBadge(
  name: string,
  prefs: WorkflowLibraryUiPrefs,
): boolean {
  return (
    isImplicitEnabledLibraryWorkflow(name, prefs) &&
    !isExplicitlyEnabledLibraryWorkflow(name, prefs)
  )
}

/** Library-tier builtin names visible in the default picker surface. */
export function resolvePickerVisibleLibraryNames(
  workflows: ReadonlyArray<Pick<WorkflowSummary, 'name' | 'source'>>,
  prefs: WorkflowLibraryUiPrefs,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const workflow of workflows) {
    if (workflow.source !== 'builtin') continue
    const packId = getLibraryPackId(workflow.name)
    if (packId === undefined) continue
    const visible =
      isExplicitlyEnabledLibraryWorkflow(workflow.name, prefs) ||
      isImplicitEnabledLibraryWorkflow(workflow.name, prefs)
    if (!visible || seen.has(workflow.name)) continue
    seen.add(workflow.name)
    out.push(workflow.name)
  }
  return out
}
