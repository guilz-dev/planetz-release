import { getBuiltinWorkflowTierMeta } from './builtin-workflow-tier.js'
import type { WorkflowSummary } from './types.js'
import { mergeWorkflowLibraryUiPrefs, type WorkflowLibraryUiPrefs } from './workflow-library-ui.js'

export function isImplicitLibraryCandidate(
  name: string,
  workflowsByName: ReadonlyMap<string, WorkflowSummary['source']>,
): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (workflowsByName.get(trimmed) !== 'builtin') return false
  return getBuiltinWorkflowTierMeta(trimmed).tier === 'library'
}

export function mergeImplicitLibraryWorkflows(
  prefs: WorkflowLibraryUiPrefs,
  candidateNames: ReadonlyArray<string>,
  workflowsByName: ReadonlyMap<string, WorkflowSummary['source']>,
): { prefs: WorkflowLibraryUiPrefs; changed: boolean } {
  const implicit = new Set(prefs.implicitEnabledWorkflows)
  const enabled = new Set(prefs.enabledWorkflows)
  const dismissed = new Set(prefs.dismissedImplicitWorkflows)
  let changed = false

  for (const raw of candidateNames) {
    const name = raw.trim()
    if (!name || !isImplicitLibraryCandidate(name, workflowsByName)) continue
    if (enabled.has(name) || dismissed.has(name) || implicit.has(name)) continue
    implicit.add(name)
    changed = true
  }

  if (!changed) {
    return { prefs, changed: false }
  }

  return {
    prefs: mergeWorkflowLibraryUiPrefs(prefs, {
      implicitEnabledWorkflows: [...implicit],
    }),
    changed: true,
  }
}
