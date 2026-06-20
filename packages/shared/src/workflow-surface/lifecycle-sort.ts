import { getBuiltinWorkflowTierMeta } from '../builtin-workflow-tier.js'
import type { WorkflowSummary } from '../types.js'

/** Deprecated library workflows sort after active/experimental within a pack or list. */
export function compareWorkflowLifecycleSort(a: WorkflowSummary, b: WorkflowSummary): number {
  const aMeta = a.source === 'builtin' ? getBuiltinWorkflowTierMeta(a.name) : undefined
  const bMeta = b.source === 'builtin' ? getBuiltinWorkflowTierMeta(b.name) : undefined
  const aDeprecated = aMeta?.lifecycle === 'deprecated' ? 1 : 0
  const bDeprecated = bMeta?.lifecycle === 'deprecated' ? 1 : 0
  if (aDeprecated !== bDeprecated) return aDeprecated - bDeprecated
  const aRank = aMeta?.displayRank ?? Number.MAX_SAFE_INTEGER
  const bRank = bMeta?.displayRank ?? Number.MAX_SAFE_INTEGER
  if (aRank !== bRank) return aRank - bRank
  return a.name.localeCompare(b.name)
}
