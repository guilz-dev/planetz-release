import {
  type BuiltinWorkflowTierMeta,
  getBuiltinWorkflowTierMeta,
} from './builtin-workflow-tier.js'
import type { WorkflowSummary } from './types.js'

/** Display label for workflow pickers (name + optional builtin displayName). */
export function workflowSummaryLabel(wf: WorkflowSummary): string {
  const tierMeta = wf.source === 'builtin' ? getBuiltinWorkflowTierMeta(wf.name) : undefined
  return workflowDisplayLabel(wf, tierMeta)
}

/** Human-facing label; builtin displayName is shown as `Display (name)`. */
export function workflowDisplayLabel(
  wf: WorkflowSummary,
  tierMeta?: BuiltinWorkflowTierMeta,
): string {
  const displayName = tierMeta?.displayName?.trim()
  if (wf.source === 'builtin' && displayName) {
    return `${displayName} (${wf.name})`
  }
  return `${wf.name} (${wf.source})`
}

/** Case-insensitive match on name, description, source, categories, and displayName. */
export function filterWorkflowSummaries(
  query: string,
  workflows: WorkflowSummary[],
  tierMetaByName?: ReadonlyMap<string, BuiltinWorkflowTierMeta>,
): WorkflowSummary[] {
  const filter = query.trim().toLowerCase()
  if (!filter) return workflows
  return workflows.filter((w) => {
    const displayName = tierMetaByName?.get(w.name)?.displayName ?? ''
    return (
      w.name.toLowerCase().includes(filter) ||
      displayName.toLowerCase().includes(filter) ||
      (w.description ?? '').toLowerCase().includes(filter) ||
      w.source.toLowerCase().includes(filter) ||
      (w.categories ?? []).some((category) => category.toLowerCase().includes(filter))
    )
  })
}
