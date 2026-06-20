import type { ChainEdge, ChainEdgeStatus, ChainGroup, TaskViewModel } from '@planetz/shared'
import { chainGroupsEqual } from '../lib/chain/chain-groups-equal.js'
import {
  cloneChainGroups,
  findChainEdge,
  removeChainEdge,
  removeChainGroup,
  setChainEdgeStatus,
  syncChainEdgeStatuses,
  upsertChainEdge,
} from '../lib/chain/chain-mutations.js'
import type { ChainMockStore } from '../mock/chain-mock-store.js'
import type { ChainFileStore } from '../sidecar/chain-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export class ChainCoordinator {
  private fileGroups: ChainGroup[] = []

  constructor(
    private readonly isMockQueueMode: () => boolean,
    private readonly mockStore: ChainMockStore,
    private readonly fileStore: ChainFileStore,
  ) {}

  reset(): void {
    this.fileGroups = []
  }

  async list(
    paths: SidecarPaths,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<ChainGroup[]> {
    if (this.isMockQueueMode()) {
      this.mockStore.syncWithTaskIds(taskIds, tasksById)
      return this.mockStore.list()
    }
    const loaded = await this.fileStore.load(paths)
    const synced = syncChainEdgeStatuses(loaded, tasksById, taskIds)
    this.fileGroups = synced
    return cloneChainGroups(this.fileGroups)
  }

  async reconcileAndPersist(
    paths: SidecarPaths,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<ChainGroup[]> {
    if (this.isMockQueueMode()) {
      this.mockStore.syncWithTaskIds(taskIds, tasksById)
      return this.mockStore.list()
    }
    const loaded = await this.fileStore.load(paths)
    const synced = syncChainEdgeStatuses(loaded, tasksById, taskIds)
    if (!chainGroupsEqual(loaded, synced)) {
      await this.fileStore.save(paths, synced)
    }
    this.fileGroups = synced
    return cloneChainGroups(this.fileGroups)
  }

  private async reloadFileGroups(
    paths: SidecarPaths,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<void> {
    const loaded = await this.fileStore.load(paths)
    this.fileGroups = syncChainEdgeStatuses(loaded, tasksById, taskIds)
  }

  async upsertEdge(
    paths: SidecarPaths,
    input: { chainId?: string; edge: ChainEdge },
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<{ chainId: string }> {
    if (this.isMockQueueMode()) {
      return this.mockStore.upsertEdge(input)
    }
    await this.reloadFileGroups(paths, taskIds, tasksById)
    const result = upsertChainEdge(this.fileGroups, input)
    this.fileGroups = syncChainEdgeStatuses(result.groups, tasksById, taskIds)
    await this.fileStore.save(paths, this.fileGroups)
    return { chainId: result.chainId }
  }

  async updateEdge(
    paths: SidecarPaths,
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    patch: Partial<ChainEdge>,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<void> {
    if (this.isMockQueueMode()) {
      const existing = findChainEdge(this.mockStore.list(), chainId, fromTaskId, toTaskId)
      if (!existing) throw new Error('Chain edge not found')
      const edge = { ...existing, ...patch }
      this.mockStore.upsertEdge({ chainId, edge })
      return
    }
    await this.reloadFileGroups(paths, taskIds, tasksById)
    const existing = findChainEdge(this.fileGroups, chainId, fromTaskId, toTaskId)
    if (!existing) throw new Error('Chain edge not found')
    const edge = { ...existing, ...patch }
    const result = upsertChainEdge(this.fileGroups, { chainId, edge })
    this.fileGroups = syncChainEdgeStatuses(result.groups, tasksById, taskIds)
    await this.fileStore.save(paths, this.fileGroups)
  }

  async removeEdge(
    paths: SidecarPaths,
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<void> {
    if (this.isMockQueueMode()) {
      this.mockStore.removeEdge(chainId, fromTaskId, toTaskId)
      return
    }
    await this.reloadFileGroups(paths, taskIds, tasksById)
    this.fileGroups = syncChainEdgeStatuses(
      removeChainEdge(this.fileGroups, chainId, fromTaskId, toTaskId),
      tasksById,
      taskIds,
    )
    await this.fileStore.save(paths, this.fileGroups)
  }

  async removeChain(
    paths: SidecarPaths,
    chainId: string,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<void> {
    if (this.isMockQueueMode()) {
      this.mockStore.removeChain(chainId)
      return
    }
    await this.reloadFileGroups(paths, taskIds, tasksById)
    this.fileGroups = syncChainEdgeStatuses(
      removeChainGroup(this.fileGroups, chainId),
      tasksById,
      taskIds,
    )
    await this.fileStore.save(paths, this.fileGroups)
  }

  async setEdgeStatus(
    paths: SidecarPaths,
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    status: ChainEdgeStatus,
    taskIds: Set<string>,
    tasksById: Map<string, TaskViewModel>,
  ): Promise<void> {
    if (this.isMockQueueMode()) {
      this.mockStore.setEdgeStatus(chainId, fromTaskId, toTaskId, status)
      return
    }
    await this.reloadFileGroups(paths, taskIds, tasksById)
    this.fileGroups = syncChainEdgeStatuses(
      setChainEdgeStatus(this.fileGroups, chainId, fromTaskId, toTaskId, status),
      tasksById,
      taskIds,
    )
    await this.fileStore.save(paths, this.fileGroups)
  }
}
