import type { ChainEdge, ChainEdgeStatus, ChainGroup, TaskViewModel } from '@planetz/shared'
import {
  cloneChainGroups,
  removeChainEdge,
  removeChainGroup,
  setChainEdgeStatus,
  syncChainEdgeStatuses,
  upsertChainEdge,
} from '../lib/chain/chain-mutations.js'

export class ChainMockStore {
  private groups: ChainGroup[] = []

  list(): ChainGroup[] {
    return cloneChainGroups(this.groups)
  }

  seed(groups: ChainGroup[]): void {
    this.groups = cloneChainGroups(groups)
  }

  upsertEdge(input: { chainId?: string; edge: ChainEdge }): { chainId: string } {
    const result = upsertChainEdge(this.groups, input)
    this.groups = result.groups
    return { chainId: result.chainId }
  }

  removeEdge(chainId: string, fromTaskId: string, toTaskId: string | undefined): void {
    this.groups = removeChainEdge(this.groups, chainId, fromTaskId, toTaskId)
  }

  removeChain(chainId: string): void {
    this.groups = removeChainGroup(this.groups, chainId)
  }

  setEdgeStatus(
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    status: ChainEdgeStatus,
  ): void {
    this.groups = setChainEdgeStatus(this.groups, chainId, fromTaskId, toTaskId, status)
  }

  syncWithTaskIds(taskIds: Set<string>, tasksById: Map<string, TaskViewModel>): void {
    this.groups = syncChainEdgeStatuses(this.groups, tasksById, taskIds)
  }
}
