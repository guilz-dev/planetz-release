import { type ChainEdge, type ChainGroup, resolveChainEdgeMode } from '@planetz/shared'

function chainEdgeEqual(a: ChainEdge, b: ChainEdge): boolean {
  return (
    a.fromTaskId === b.fromTaskId &&
    a.toTaskId === b.toTaskId &&
    resolveChainEdgeMode(a) === resolveChainEdgeMode(b) &&
    a.status === b.status &&
    a.sourceBranch === b.sourceBranch &&
    a.baseBranch === b.baseBranch &&
    JSON.stringify(a.planned ?? null) === JSON.stringify(b.planned ?? null)
  )
}

function sortedTaskIds(ids: string[]): string {
  return [...ids].sort().join('\0')
}

/** Returns true when persisted chain state would be unchanged. */
export function chainGroupsEqual(a: ChainGroup[], b: ChainGroup[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort((x, y) => x.id.localeCompare(y.id))
  const right = [...b].sort((x, y) => x.id.localeCompare(y.id))
  for (let i = 0; i < left.length; i++) {
    if (left[i].id !== right[i].id) return false
    if (sortedTaskIds(left[i].taskIds) !== sortedTaskIds(right[i].taskIds)) return false
    const le = [...left[i].edges].sort(
      (x, y) =>
        x.fromTaskId.localeCompare(y.fromTaskId) ||
        (x.toTaskId ?? '').localeCompare(y.toTaskId ?? ''),
    )
    const re = [...right[i].edges].sort(
      (x, y) =>
        x.fromTaskId.localeCompare(y.fromTaskId) ||
        (x.toTaskId ?? '').localeCompare(y.toTaskId ?? ''),
    )
    if (le.length !== re.length) return false
    for (let j = 0; j < le.length; j++) {
      if (!chainEdgeEqual(le[j], re[j])) return false
    }
  }
  return true
}
