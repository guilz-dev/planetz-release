import type { UiConfig } from '@planetz/shared'
import {
  type ChainEdge,
  type ChainEdgeStatus,
  type ChainMaterializeResult,
  type ChainPlannedTask,
  parseChainEdgeKey,
  type TaskViewModel,
  uniqueTaskId,
} from '@planetz/shared'
import { deriveEdgeStatusFromUpstream } from '../lib/chain/chain-edge-status.js'
import { buildChainTaskEnqueueBody } from '../lib/chain/chain-planned-enqueue.js'
import { gitBranchExists } from '../lib/git-branch-exists.js'
import type { MockQueueStore } from '../sidecar/mock-queue-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import type { ChainCoordinator } from './chain-coordinator.js'

export interface CreateChainTaskInput {
  fromTaskId: string
  title: string
  body?: string
  workflow?: string
  mode: 'branch_handoff' | 'merge_then_continue'
  sourceBranch?: string
  baseBranch?: string
  chainId?: string
  deferTaskCreation?: boolean
}

export interface ChainWorkflowDeps {
  chainCoordinator: ChainCoordinator
  mockQueueStore: MockQueueStore
  mockQueueEnabled: () => boolean
  getMockTasks: () => TaskViewModel[]
  setMockTasks: (tasks: TaskViewModel[]) => void
  getConnector: () => TaktConnectorCli | null
  requireSidecarPaths: () => SidecarPaths
  requireWorkspacePath: () => string
  requireConfig: () => UiConfig
  listTasksForChain: () => Promise<TaskViewModel[]>
  invalidateTaktTaskYamlCache: () => void
  taktTaskIdSet: (tasks: TaskViewModel[]) => Set<string>
  onAfterChainMutation: (selectedTaskId?: string) => Promise<void>
}

export class ChainWorkflowService {
  private readonly materializeInFlight = new Set<string>()

  constructor(private readonly deps: ChainWorkflowDeps) {}

  async createChainTask(
    input: CreateChainTaskInput,
  ): Promise<{ chainId: string; taskId?: string }> {
    const { paths, tasksById } = await this.chainSyncContext()
    const origin = tasksById.get(input.fromTaskId)
    if (!origin) throw new Error(`Task not found: ${input.fromTaskId}`)

    const defer = input.deferTaskCreation !== false
    const sourceBranch = input.sourceBranch ?? origin.sourceBranch
    const baseBranch = input.baseBranch ?? origin.baseBranch ?? 'main'
    const planned: ChainPlannedTask = {
      title: input.title,
      body: input.body,
      workflow: input.workflow ?? origin.workflow,
      mode: input.mode,
      sourceBranch,
      baseBranch,
    }

    const taskIds = new Set(tasksById.keys())

    if (!defer) {
      const { taskId, chainId } = await this.materializePlannedTask({
        origin,
        planned,
        chainId: input.chainId,
        paths,
        taskIds,
        tasksById,
      })
      await this.deps.onAfterChainMutation(taskId)
      return { chainId, taskId }
    }

    const edge: ChainEdge = {
      fromTaskId: origin.id,
      status: deriveEdgeStatusFromUpstream(origin),
      sourceBranch,
      baseBranch,
      planned,
    }
    const { chainId } = await this.deps.chainCoordinator.upsertEdge(
      paths,
      { chainId: input.chainId, edge },
      taskIds,
      tasksById,
    )
    await this.deps.onAfterChainMutation()
    return { chainId }
  }

  async materializeChainEdge(input: {
    chainId: string
    fromTaskId: string
  }): Promise<ChainMaterializeResult> {
    const flightKey = `${input.chainId}:${input.fromTaskId}`
    if (this.materializeInFlight.has(flightKey)) {
      throw new Error('Chain materialize already in progress')
    }
    this.materializeInFlight.add(flightKey)
    try {
      const { paths, taskIds, tasksById } = await this.chainSyncContext()
      const origin = tasksById.get(input.fromTaskId)
      if (!origin) throw new Error(`Task not found: ${input.fromTaskId}`)
      const groups = await this.deps.chainCoordinator.list(paths, taskIds, tasksById)
      const edge = groups
        .find((g) => g.id === input.chainId)
        ?.edges.find((e) => e.fromTaskId === input.fromTaskId && !e.toTaskId)
      if (!edge?.planned) {
        const created = groups
          .find((g) => g.id === input.chainId)
          ?.edges.find((e) => e.fromTaskId === input.fromTaskId && e.toTaskId)
        if (created?.toTaskId && created.status === 'created') {
          return { taskId: created.toTaskId, chainId: input.chainId }
        }
        throw new Error('No pending chain edge to materialize')
      }
      if (edge.status !== 'ready_to_create') {
        throw new Error(`Chain edge is not ready (status: ${edge.status})`)
      }

      const warnings = await this.collectBranchWarnings(edge.planned)
      const result = await this.materializePlannedTask({
        origin,
        planned: edge.planned,
        chainId: input.chainId,
        paths,
        taskIds,
        tasksById,
        existingEdge: edge,
      })
      await this.deps.onAfterChainMutation(result.taskId)
      return { ...result, warnings: warnings.length > 0 ? warnings : undefined }
    } finally {
      this.materializeInFlight.delete(flightKey)
    }
  }

  async checkSourceBranch(branch: string): Promise<{ exists: boolean }> {
    const trimmed = branch.trim()
    if (!trimmed) return { exists: false }
    if (this.deps.mockQueueEnabled()) return { exists: true }
    const cwd = this.deps.requireWorkspacePath()
    return { exists: await gitBranchExists(cwd, trimmed) }
  }

  async removeChain(chainId: string, edgeKey?: string): Promise<void> {
    const { paths, taskIds, tasksById } = await this.chainSyncContext()
    if (!edgeKey) {
      await this.deps.chainCoordinator.removeChain(paths, chainId, taskIds, tasksById)
      await this.deps.onAfterChainMutation()
      return
    }
    const { fromTaskId, toTaskId } = parseChainEdgeKey(edgeKey)
    await this.deps.chainCoordinator.removeEdge(
      paths,
      chainId,
      fromTaskId,
      toTaskId,
      taskIds,
      tasksById,
    )
    await this.deps.onAfterChainMutation()
  }

  async setChainEdgeStatus(
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    status: ChainEdgeStatus,
  ): Promise<void> {
    const { paths, taskIds, tasksById } = await this.chainSyncContext()
    await this.deps.chainCoordinator.setEdgeStatus(
      paths,
      chainId,
      fromTaskId,
      toTaskId,
      status,
      taskIds,
      tasksById,
    )
    await this.deps.onAfterChainMutation()
  }

  private async collectBranchWarnings(planned: ChainPlannedTask): Promise<string[]> {
    const branch = planned.sourceBranch?.trim()
    if (!branch || this.deps.mockQueueEnabled()) return []
    const cwd = this.deps.requireWorkspacePath()
    const exists = await gitBranchExists(cwd, branch)
    if (exists) return []
    return [`Source branch "${branch}" was not found locally (checked refs/heads and origin).`]
  }

  private async chainSyncContext(): Promise<{
    paths: SidecarPaths
    taskIds: Set<string>
    tasksById: Map<string, TaskViewModel>
  }> {
    const paths = this.deps.requireSidecarPaths()
    const tasks = await this.deps.listTasksForChain()
    const tasksById = new Map(tasks.map((t) => [t.id, t]))
    const taskIds = new Set(tasksById.keys())
    return { paths, taskIds, tasksById }
  }

  private async materializePlannedTask(input: {
    origin: TaskViewModel
    planned: ChainPlannedTask
    chainId?: string
    paths: SidecarPaths
    taskIds: Set<string>
    tasksById: Map<string, TaskViewModel>
    existingEdge?: ChainEdge
  }): Promise<{ taskId: string; chainId: string }> {
    if (input.existingEdge?.toTaskId && input.chainId) {
      return { taskId: input.existingEdge.toTaskId, chainId: input.chainId }
    }

    let toTaskId: string
    const enqueueBody = buildChainTaskEnqueueBody(input.planned, input.origin)

    if (this.deps.mockQueueEnabled()) {
      const mockTasks = this.deps.getMockTasks()
      const existing = new Set(mockTasks.map((t) => t.id))
      const now = new Date().toISOString()
      const toTask: TaskViewModel = {
        id: uniqueTaskId(input.planned.title, existing),
        title: input.planned.title,
        body: enqueueBody,
        workflow: input.planned.workflow ?? input.origin.workflow,
        priority: 'normal',
        status: 'pending',
        source: 'user',
        dependsOnTaskId: input.origin.id,
        sourceBranch: input.planned.sourceBranch,
        baseBranch: input.planned.baseBranch,
        chainId: input.chainId,
        createdAt: now,
        updatedAt: now,
      }
      this.deps.setMockTasks([toTask, ...mockTasks])
      toTaskId = toTask.id
      await this.deps.mockQueueStore.save(input.paths, this.deps.getMockTasks())
    } else {
      const connector = this.deps.getConnector()
      if (!connector) throw new Error('Connector unavailable')
      const existing = this.deps.taktTaskIdSet([...input.tasksById.values()])
      const result = await connector.enqueueTask(
        {
          title: input.planned.title,
          body: enqueueBody,
          workflow: input.planned.workflow ?? input.origin.workflow,
          priority: 'normal',
        },
        existing,
      )
      toTaskId = result.taskId
      this.deps.invalidateTaktTaskYamlCache()
    }

    let chainId = input.chainId
    const materializedEdge: ChainEdge = {
      fromTaskId: input.origin.id,
      toTaskId,
      mode: input.planned.mode,
      status: 'created',
      sourceBranch: input.planned.sourceBranch,
      baseBranch: input.planned.baseBranch,
      planned: input.planned,
    }

    if (input.existingEdge && !input.existingEdge.toTaskId && chainId) {
      await this.deps.chainCoordinator.updateEdge(
        input.paths,
        chainId,
        input.origin.id,
        undefined,
        materializedEdge,
        input.taskIds,
        input.tasksById,
      )
    } else {
      const upserted = await this.deps.chainCoordinator.upsertEdge(
        input.paths,
        { chainId: input.chainId, edge: materializedEdge },
        input.taskIds,
        input.tasksById,
      )
      chainId = upserted.chainId
    }

    return { taskId: toTaskId, chainId: chainId as string }
  }
}
