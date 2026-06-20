import type { ChainEdge, ChainEdgeStatus, ChainGroup, TaskViewModel } from '@planetz/shared'
import { syncEdgeStatusWithUpstream } from './chain-edge-status.js'

export function cloneChainGroups(groups: ChainGroup[]): ChainGroup[] {
  return groups.map((g) => ({ ...g, edges: [...g.edges], taskIds: [...g.taskIds] }))
}

function edgeMatches(e: ChainEdge, fromTaskId: string, toTaskId: string | undefined): boolean {
  if (e.fromTaskId !== fromTaskId) return false
  if (toTaskId === undefined) return e.toTaskId === undefined
  return e.toTaskId === toTaskId
}

function collectTaskIdsForEdge(edge: ChainEdge): string[] {
  const ids = [edge.fromTaskId]
  if (edge.toTaskId) ids.push(edge.toTaskId)
  return ids
}

export function upsertChainEdge(
  groups: ChainGroup[],
  input: { chainId?: string; edge: ChainEdge },
): { groups: ChainGroup[]; chainId: string } {
  const { edge } = input
  let chainId = input.chainId
  const now = new Date().toISOString()
  let next = cloneChainGroups(groups)

  if (!chainId) {
    const existing = next.find((g) => g.taskIds.includes(edge.fromTaskId))
    if (existing) {
      chainId = existing.id
    } else {
      chainId = `chain-${edge.fromTaskId}`
      next = [...next, { id: chainId, createdAt: now, taskIds: [edge.fromTaskId], edges: [] }]
    }
  }

  next = next.map((g) => {
    if (g.id !== chainId) return g
    const taskIds = new Set([...g.taskIds, ...collectTaskIdsForEdge(edge)])
    const edges = g.edges.filter((e) => !edgeMatches(e, edge.fromTaskId, edge.toTaskId))
    edges.push(edge)
    return { ...g, taskIds: [...taskIds], edges }
  })
  return { groups: next, chainId: chainId as string }
}

export function removeChainEdge(
  groups: ChainGroup[],
  chainId: string,
  fromTaskId: string,
  toTaskId: string | undefined,
): ChainGroup[] {
  return groups
    .map((g) => {
      if (g.id !== chainId) return g
      const edges = g.edges.filter((e) => !edgeMatches(e, fromTaskId, toTaskId))
      const referenced = new Set<string>()
      for (const e of edges) {
        referenced.add(e.fromTaskId)
        if (e.toTaskId) referenced.add(e.toTaskId)
      }
      return { ...g, edges, taskIds: g.taskIds.filter((id) => referenced.has(id)) }
    })
    .filter((g) => g.edges.length > 0)
}

export function removeChainGroup(groups: ChainGroup[], chainId: string): ChainGroup[] {
  return groups.filter((g) => g.id !== chainId)
}

export function setChainEdgeStatus(
  groups: ChainGroup[],
  chainId: string,
  fromTaskId: string,
  toTaskId: string | undefined,
  status: ChainEdgeStatus,
): ChainGroup[] {
  return groups.map((g) => {
    if (g.id !== chainId) return g
    return {
      ...g,
      edges: g.edges.map((e) => (edgeMatches(e, fromTaskId, toTaskId) ? { ...e, status } : e)),
    }
  })
}

export function findChainEdge(
  groups: ChainGroup[],
  chainId: string,
  fromTaskId: string,
  toTaskId?: string,
): ChainEdge | undefined {
  const group = groups.find((g) => g.id === chainId)
  if (!group) return undefined
  return group.edges.find((e) => edgeMatches(e, fromTaskId, toTaskId))
}

export function syncChainGroupsWithTaskIds(
  groups: ChainGroup[],
  taskIds: Set<string>,
): ChainGroup[] {
  return groups.map((g) => ({
    ...g,
    edges: g.edges.map((e) => {
      const missingFrom = !taskIds.has(e.fromTaskId)
      const missingTo = e.toTaskId !== undefined && !taskIds.has(e.toTaskId)
      if (missingFrom || missingTo) {
        return { ...e, status: 'invalid' as const }
      }
      return e
    }),
  }))
}

export function syncChainEdgeStatuses(
  groups: ChainGroup[],
  tasksById: Map<string, TaskViewModel>,
  taskIds: Set<string>,
): ChainGroup[] {
  const withInvalid = syncChainGroupsWithTaskIds(groups, taskIds)
  return withInvalid.map((g) => ({
    ...g,
    edges: g.edges.map((e) => {
      if (e.status === 'invalid' || e.status === 'created') return e
      const upstream = tasksById.get(e.fromTaskId)
      if (!upstream) return e
      return { ...e, status: syncEdgeStatusWithUpstream(e.status, upstream.status) }
    }),
  }))
}
