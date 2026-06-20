import {
  type EnqueueTaskBridgeInput,
  type EnqueueTaskInput,
  type EnqueueTaskResult,
  evaluateOllamaExecutionGuard,
  filterTaskUsableWorkflowNames,
  OllamaExecutionBlockedError,
  type OllamaExecutionGuardPreviewResult,
  type OllamaExecutionGuardResult,
  ollamaToolsGuardFromUi,
  stripRuntimeWorkflowOverrideSuffix,
  type TaskSwapWorkflowInput,
  type TaskSwapWorkflowResult,
  type TaskViewModel,
  type UiState,
  type WorkflowAutoRoutePreviewResult,
  type WorkflowGetPreviewInput,
  type WorkflowPreviewAutoRouteInput,
  type WorkflowPreviewResult,
  type WorkflowRoutingAuditRecord,
} from '@planetz/shared'
import { deletePendingTaskPackage } from '../lib/delete-task-package.js'
import { resolveExecutorIdFromProfile } from '../lib/projection/executor-projection.js'
import {
  reconcileStaleRunningAfterStop,
  resolveRunningTaskOwnerPid,
  stopProcessGracefully,
} from '../lib/running-task-stop.js'
import {
  normalizeEnqueueTitle,
  resolveEnqueueInput,
  type TaskTitleLlmContext,
} from '../lib/title-generator.js'
import { mergeTaskAssignment } from '../lib/ui-state-task-assignments.js'
import { updatePendingTaskWorkflow } from '../lib/update-pending-task-workflow.js'
import { createDerivedTask, createMockTaskFromEnqueue } from '../mock/create-mock-task.js'
import { captureRunSupplySnapshot } from '../planetz/run-supply-snapshot.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  deleteTaskWorkflowSelectionMeta,
  insertTaskWorkflowSelectionMeta,
} from '../storage/sqlite/repositories/task-workflow-selection-meta-repository.js'
import { insertWorkflowRoutingAudit } from '../storage/sqlite/repositories/workflow-routing-audit-repository.js'
import {
  persistDeriveSidecar,
  persistEnqueueSidecar,
} from '../storage/sqlite/sidecar-write-scope.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import { applyAutoWorkflowResolution } from './apply-auto-workflow-resolution.js'
import type { TaskCommandPort } from './task-command-port.js'
import {
  buildDeriveEnqueueInput,
  taskViewModelToRuntimeEnqueueInput,
} from './task-enqueue-input.js'
import {
  applyTaskMutationUiState,
  finalizeTaskMutation,
  persistTaskMutationSideEffects,
  prepareTaskMutationContext,
  rollbackTaskMutationIfNeeded,
} from './task-mutation-pipeline.js'
import type { RuntimeAutoWorkflowFilter } from './workflow-auto/enabled-workflows.js'
import type { WorkflowAutoRouteContext } from './workflow-auto/router.js'
import { buildWorkflowRoutingResolverKey } from './workflow-auto/routing-feature-cache.js'
import { buildWorkflowSourceMap } from './workflow-auto/workflow-source-map.js'
import { createRoutingWorkflowResolver } from './workflow-auto/workflow-yaml-resolver.js'
import { resolveFallbackWorkflow } from './workflow-auto-fallback.js'
import { WorkflowPreviewCache } from './workflow-selection/workflow-preview-cache.js'
import {
  getWorkflowPreview,
  previewWorkflowAutoRoute,
  type WorkflowPreviewServiceDeps,
} from './workflow-selection/workflow-preview-service.js'
import { buildRoutingPromptHash } from './workflow-selection/workflow-prompt-hash.js'
import { assertRunOverrideAllowedForWorkflow } from './workflow-selection/workflow-run-override-resolver.js'
import {
  buildWorkflowSelectionMeta,
  materializeRunOverrideWorkflow,
} from './workflow-selection/workflow-selection-enqueue.js'

export type { TaskCommandPort } from './task-command-port.js'

function isEnqueueTraceEnabled(): boolean {
  if (process.env.PLANETZ_TRACE_ENQUEUE === '1') return true
  if (process.env.PLANETZ_TRACE_ENQUEUE === '0') return false
  return process.env.NODE_ENV_ELECTRON_VITE === 'development'
}

const ENQUEUE_TRACE_ENABLED = isEnqueueTraceEnabled()
const RUN_NOW_WATCH_FALLBACK_MS = 15_000

function excludeChatOnlyWorkflowsForTask(workflowNames: string[]): string[] {
  return filterTaskUsableWorkflowNames(workflowNames)
}

function traceEnqueue(step: string, fields?: Record<string, unknown>): void {
  if (!ENQUEUE_TRACE_ENABLED) return
  const at = new Date().toISOString()
  if (fields) {
    console.info(`[enqueue][${at}] ${step}`, fields)
    return
  }
  console.info(`[enqueue][${at}] ${step}`)
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'unknown error'
}

function summarizeInput(input: EnqueueTaskBridgeInput | EnqueueTaskInput): Record<string, unknown> {
  return {
    workflow: input.workflow ?? null,
    priority: input.priority ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    titleLength: input.title?.length ?? 0,
    bodyLength: input.body?.length ?? 0,
  }
}

export class TaskCommandService {
  private readonly runNowWatchFallbackTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly workflowPreviewCache = new WorkflowPreviewCache()

  constructor(private readonly port: TaskCommandPort) {}

  private workflowPreviewDeps(): WorkflowPreviewServiceDeps {
    return {
      readWorkflowDocument: (name, source) => this.port.readWorkflowDocument(name, source),
      loadWorkflowRoutingCatalog: () => this.port.loadWorkflowRoutingCatalog(),
      listAvailableWorkflowNames: async () =>
        excludeChatOnlyWorkflowsForTask(await this.port.listAvailableWorkflowNames()),
      buildAutoRouteContext: (input) => this.buildWorkflowAutoRouteContext(input),
      previewCache: this.workflowPreviewCache,
    }
  }

  async getWorkflowPreview(input: WorkflowGetPreviewInput): Promise<WorkflowPreviewResult> {
    const catalog = await this.port.loadWorkflowRoutingCatalog()
    return getWorkflowPreview(this.workflowPreviewDeps(), input, catalog)
  }

  async previewWorkflowAutoRoute(
    input: WorkflowPreviewAutoRouteInput,
  ): Promise<WorkflowAutoRoutePreviewResult> {
    return previewWorkflowAutoRoute(this.workflowPreviewDeps(), input)
  }

  async swapTaskWorkflow(input: TaskSwapWorkflowInput): Promise<TaskSwapWorkflowResult> {
    const taskId = input.taskId.trim()
    const workflow = input.workflow.trim()
    if (!taskId || !workflow) throw new Error('taskId and workflow are required')

    const tasks = await this.readTaktTasksFresh()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    if (task.status !== 'pending') {
      throw new Error(`Only queued tasks can swap workflow (status: ${task.status})`)
    }

    let resolvedWorkflow = workflow
    if (input.runOverride) {
      const catalog = await this.port.loadWorkflowRoutingCatalog()
      assertRunOverrideAllowedForWorkflow(catalog, input.runOverride.baseWorkflow)
      const baseYaml = await this.port.readWorkflowYaml(input.runOverride.baseWorkflow)
      if (!baseYaml) throw new Error(`Workflow not found: ${input.runOverride.baseWorkflow}`)
      const paths = this.port.requireSidecarPaths()
      resolvedWorkflow = await materializeRunOverrideWorkflow(paths, baseYaml, input.runOverride)
    }

    const repoPath = this.port.requireTaktRepoPath()
    const config = this.port.requireConfig()
    const updated = await updatePendingTaskWorkflow(repoPath, config, taskId, resolvedWorkflow)
    if (!updated) throw new Error(`Failed to update workflow for task ${taskId}`)

    const selectionMeta = buildWorkflowSelectionMeta(
      {
        workflow,
        workflowMode: input.workflowMode ?? 'manual',
        runOverride: input.runOverride,
        workflowSelectionKind: input.selectionKind,
        title: task.title,
      },
      resolvedWorkflow,
    )
    const db = await getSidecarSqlite(this.port.requireSidecarPaths())
    if (selectionMeta) {
      insertTaskWorkflowSelectionMeta(db, taskId, selectionMeta, new Date().toISOString())
    }
    insertWorkflowRoutingAudit(db, taskId, {
      version: 1,
      at: new Date().toISOString(),
      taskRequirements: {
        intent: [],
        expectedOutput: [],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'medium',
        blockingUnknowns: [],
      },
      candidatePool: [],
      selectedWorkflow: resolvedWorkflow,
      confidence: 'high',
      decisionReason: 'queue-workflow-swap',
      comparedDifferences: [],
    })

    this.port.invalidateTaktTaskYamlCache?.()
    await this.port.refreshState()
    return { taskId, workflow: resolvedWorkflow }
  }

  private async resolveEnqueueBridgeInput(
    input: EnqueueTaskBridgeInput,
  ): Promise<EnqueueTaskInput> {
    const llm = await this.resolveTitleLlmContext(input)
    return resolveEnqueueInput(input, llm)
  }

  private async resolveTitleLlmContext(
    input: EnqueueTaskBridgeInput,
  ): Promise<TaskTitleLlmContext | undefined> {
    if (normalizeEnqueueTitle(input.title ?? '').length > 0) {
      return undefined
    }
    const body = input.body?.trim() ?? ''
    if (body.length === 0 || !this.port.workspacePath) {
      return undefined
    }
    try {
      const profile = await this.port.resolveExecutionProfileForInput({
        title: 'pending',
        body,
        workflow: input.workflow,
        provider: input.provider,
        model: input.model,
      })
      const provider = profile.provider?.trim()
      if (!provider) {
        return undefined
      }
      const cwd = this.port.mockQueueEnabled()
        ? this.port.requireWorkspacePath()
        : this.port.requireTaktRepoPath()
      const engineConfig = await this.port.loadEffectiveEngineConfig()
      return { provider, model: profile.model, cwd, engineConfig }
    } catch {
      return undefined
    }
  }

  /** Enqueue and preview use the same explicit Ollama guard; no implicit workflow remap. */
  private async prepareOllamaExecutionInput(resolved: EnqueueTaskInput): Promise<EnqueueTaskInput> {
    await this.guardOllamaExecution(resolved)
    return resolved
  }

  private async evaluateOllamaGuardForResolved(
    resolved: EnqueueTaskInput,
  ): Promise<OllamaExecutionGuardResult> {
    const guardMode = ollamaToolsGuardFromUi(this.port.config?.ui)
    const profile = await this.port.resolveExecutionProfileForInput(resolved)
    const workflowName = resolved.workflow?.trim()
    const workflowYaml =
      workflowName && workflowName.length > 0
        ? await this.port.readWorkflowYaml(workflowName)
        : null
    return evaluateOllamaExecutionGuard({
      provider: profile.provider,
      workflowYaml,
      guardMode,
      ...(workflowName ? { workflowName } : {}),
    })
  }

  private async guardOllamaExecution(resolved: EnqueueTaskInput): Promise<void> {
    const result = await this.evaluateOllamaGuardForResolved(resolved)
    if (result.action === 'block') {
      throw new OllamaExecutionBlockedError(result.issues)
    }
    if (result.action === 'warn') {
      traceEnqueue('ollamaGuard:warn', {
        workflow: resolved.workflow?.trim() ?? null,
        issues: result.issues,
      })
    }
  }

  async previewOllamaExecutionGuard(
    input: EnqueueTaskBridgeInput,
  ): Promise<OllamaExecutionGuardPreviewResult> {
    const bridgeInput = await this.resolveGuardPreviewBridgeInput(input)
    const resolved = await this.resolveEnqueueBridgeInput(bridgeInput)
    return this.evaluateOllamaGuardForResolved(resolved)
  }

  private async buildRuntimeAutoFilter(): Promise<RuntimeAutoWorkflowFilter> {
    const workflows = await this.port.listWorkflowSummaries()
    return {
      workflowsByName: buildWorkflowSourceMap(workflows),
      uiPrefs: this.port.requireConfig().ui.workflowLibrary,
    }
  }

  private async buildWorkflowAutoRouteContext(
    input: EnqueueTaskBridgeInput,
  ): Promise<WorkflowAutoRouteContext> {
    const engineConfig = await this.port.loadEffectiveEngineConfig()
    const mockQueue = this.port.mockQueueEnabled()
    const cwd = mockQueue ? this.port.requireWorkspacePath() : this.port.requireTaktRepoPath()
    const paths = this.port.requireSidecarPaths()
    const config = this.port.requireConfig()
    const workspacePath = this.port.requireWorkspacePath()
    const taktRepoPath = mockQueue ? null : this.port.requireTaktRepoPath()
    const resolverKey = buildWorkflowRoutingResolverKey({
      mockQueue,
      planetzWorkflowsDir: paths.planetzWorkflowsDir,
      workspacePath,
      taktRepoPath,
    })
    this.port.workflowRoutingFeatureCache.ensureResolverKey(resolverKey)
    const resolveWorkflowYaml = createRoutingWorkflowResolver({
      sidecarWorkflowsDir: paths.planetzWorkflowsDir,
      workspacePath,
      config,
      taktRepoPath,
      mode: mockQueue ? 'mock-builtin-only' : 'production',
    })
    return {
      cwd,
      engineConfig,
      provider: input.provider,
      model: input.model,
      resolveWorkflowYaml,
      featureCache: this.port.workflowRoutingFeatureCache,
      runtimeAutoFilter: await this.buildRuntimeAutoFilter(),
      resolveKiroRoutingContext: () => this.port.resolveKiroRoutingContext(),
    }
  }

  private async resolveAutoWorkflowIfNeeded(input: EnqueueTaskBridgeInput): Promise<{
    bridgeInput: EnqueueTaskBridgeInput
    autoDecision?: EnqueueTaskResult['autoDecision']
    routingAudit?: WorkflowRoutingAuditRecord
  }> {
    const confirmed = input.confirmedWorkflow?.trim()
    if (confirmed) {
      return {
        bridgeInput: {
          ...input,
          workflow: confirmed,
          workflowMode: 'manual',
          workflowSelectionKind: input.workflowSelectionKind ?? 'auto',
        },
      }
    }

    const mode = input.workflowMode ?? 'manual'
    if (mode !== 'auto') {
      return { bridgeInput: input }
    }

    const promptHash =
      input.routingPromptHash ?? buildRoutingPromptHash({ title: input.title, body: input.body })
    if (input.routingPreviewToken) {
      const cached = this.workflowPreviewCache.get(input.routingPreviewToken, promptHash)
      if (cached && cached.phase === 'full') {
        return {
          bridgeInput: {
            ...input,
            workflow: cached.decision.selectedWorkflow,
            workflowMode: 'manual',
            workflowSelectionKind: 'auto',
          },
          autoDecision: cached.decision,
          routingAudit: cached.audit,
        }
      }
    }

    const catalog = await this.port.loadWorkflowRoutingCatalog()
    const availableWorkflowNames = excludeChatOnlyWorkflowsForTask(
      await this.port.listAvailableWorkflowNames(),
    )
    const ctx = await this.buildWorkflowAutoRouteContext(input)
    const {
      input: bridgeInput,
      autoDecision,
      routingAudit,
    } = await applyAutoWorkflowResolution(input, catalog, availableWorkflowNames, ctx)
    return {
      bridgeInput: { ...bridgeInput, workflowSelectionKind: 'auto' },
      autoDecision,
      routingAudit,
    }
  }

  private async applyRunOverrideIfNeeded(
    input: EnqueueTaskBridgeInput,
  ): Promise<EnqueueTaskBridgeInput> {
    const override = input.runOverride
    if (!override || override.stepOverrides.length === 0) return input
    const selectedWorkflow = input.workflow?.trim()
    if (!selectedWorkflow) return input
    if (stripRuntimeWorkflowOverrideSuffix(selectedWorkflow) !== override.baseWorkflow) {
      return input
    }
    const catalog = await this.port.loadWorkflowRoutingCatalog()
    assertRunOverrideAllowedForWorkflow(catalog, override.baseWorkflow)
    const baseYaml = await this.port.readWorkflowYaml(override.baseWorkflow)
    if (!baseYaml) throw new Error(`Workflow not found: ${override.baseWorkflow}`)
    const paths = this.port.requireSidecarPaths()
    const resolvedWorkflow = await materializeRunOverrideWorkflow(paths, baseYaml, override)
    return {
      ...input,
      workflow: resolvedWorkflow,
      workflowSelectionKind: input.workflowSelectionKind ?? 'modified',
    }
  }

  private async resolveGuardPreviewBridgeInput(
    input: EnqueueTaskBridgeInput,
  ): Promise<EnqueueTaskBridgeInput> {
    if (input.workflow?.trim()) {
      return { ...input, workflowMode: 'manual' }
    }
    const catalog = await this.port.loadWorkflowRoutingCatalog()
    const availableWorkflowNames = excludeChatOnlyWorkflowsForTask(
      await this.port.listAvailableWorkflowNames(),
    )
    const workflow =
      resolveFallbackWorkflow(catalog, availableWorkflowNames) ??
      availableWorkflowNames[0] ??
      'default'
    return { ...input, workflow, workflowMode: 'manual' }
  }

  private async prepareEnqueueBridgeInput(input: EnqueueTaskBridgeInput): Promise<{
    bridgeInput: EnqueueTaskBridgeInput
    autoDecision?: EnqueueTaskResult['autoDecision']
    routingAudit?: WorkflowRoutingAuditRecord
  }> {
    const withOverride = await this.applyRunOverrideIfNeeded(input)
    return this.resolveAutoWorkflowIfNeeded(withOverride)
  }

  async enqueueTask(input: EnqueueTaskBridgeInput): Promise<EnqueueTaskResult> {
    const startedAt = Date.now()
    traceEnqueue('enqueueTask:start', summarizeInput(input))
    try {
      const { bridgeInput, autoDecision, routingAudit } =
        await this.prepareEnqueueBridgeInput(input)
      const workflowSelectionMeta = buildWorkflowSelectionMeta(
        input,
        bridgeInput.workflow,
        autoDecision,
        bridgeInput.workflowSelectionKind,
      )
      const resolved: EnqueueTaskInput = await this.resolveEnqueueBridgeInput(bridgeInput)
      traceEnqueue('enqueueTask:resolved', summarizeInput(resolved))
      const result = await this.enqueueResolvedTask(
        resolved,
        autoDecision,
        routingAudit,
        workflowSelectionMeta,
      )
      traceEnqueue('enqueueTask:done', { taskId: result.taskId, elapsedMs: Date.now() - startedAt })
      return result
    } catch (error: unknown) {
      traceEnqueue('enqueueTask:error', {
        elapsedMs: Date.now() - startedAt,
        message: summarizeError(error),
      })
      throw error
    }
  }

  async enqueueResolvedTask(
    resolved: EnqueueTaskInput,
    autoDecision?: EnqueueTaskResult['autoDecision'],
    routingAudit?: WorkflowRoutingAuditRecord,
    workflowSelectionMeta?: import('@planetz/shared').TaskWorkflowSelectionMeta,
  ): Promise<EnqueueTaskResult> {
    const startedAt = Date.now()
    const enqueueInput = await this.prepareOllamaExecutionInput(resolved)
    const ctx = prepareTaskMutationContext(this.port)
    traceEnqueue('enqueueResolvedTask:start', {
      ...summarizeInput(enqueueInput),
      mockQueue: this.port.mockQueueEnabled(),
      hasConnector: Boolean(this.port.connector),
    })
    let taskId: string
    try {
      if (this.port.mockQueueEnabled()) {
        const mockStartedAt = Date.now()
        const existing = new Set(this.port.mockTasks.map((t) => t.id))
        const task = createMockTaskFromEnqueue(enqueueInput, existing)
        this.port.mockTasks = [task, ...this.port.mockTasks]
        taskId = task.id
        traceEnqueue('enqueueResolvedTask:mockPrepared', {
          taskId,
          existingCount: existing.size,
          elapsedMs: Date.now() - mockStartedAt,
        })
      } else if (this.port.connector) {
        const loadStartedAt = Date.now()
        const tasks = await this.readTaktTasksFresh()
        const existing = this.port.taktTaskIdSet(tasks)
        traceEnqueue('enqueueResolvedTask:loadedTasks', {
          taskCount: tasks.length,
          existingCount: existing.size,
          elapsedMs: Date.now() - loadStartedAt,
        })
        const connectorStartedAt = Date.now()
        const result = await this.port.connector.enqueueTask(enqueueInput, existing)
        taskId = result.taskId
        this.port.invalidateTaktTaskYamlCache()
        traceEnqueue('enqueueResolvedTask:connectorDone', {
          taskId,
          elapsedMs: Date.now() - connectorStartedAt,
        })
      } else {
        throw new Error('Connector unavailable')
      }

      const profileStartedAt = Date.now()
      const profile = await this.port.resolveExecutionProfileForInput(enqueueInput)
      traceEnqueue('enqueueResolvedTask:profileResolved', {
        taskId,
        elapsedMs: Date.now() - profileStartedAt,
      })
      const executorId =
        resolveExecutorIdFromProfile(profile.provider) ??
        (enqueueInput.assignedAgentId?.trim() ? enqueueInput.assignedAgentId.trim() : undefined)
      const nextUiState: UiState = {
        ...this.port.uiState,
        selectedTaskId: taskId,
        ...(executorId
          ? { taskAssignments: mergeTaskAssignment(this.port.uiState, taskId, executorId) }
          : {}),
      }

      const persistStartedAt = Date.now()
      await persistTaskMutationSideEffects(ctx, () =>
        persistEnqueueSidecar(ctx.paths, {
          mode: this.port.mockQueueEnabled() ? 'mock' : 'production',
          ...(this.port.mockQueueEnabled() ? { mockTasks: this.port.mockTasks } : {}),
          conversation: {
            taskId,
            role: 'user',
            kind: 'initial_order',
            body: enqueueInput.body?.trim() || enqueueInput.title,
          },
          promptHistory: {
            title: enqueueInput.title,
            body: enqueueInput.body ?? '',
            workflow: enqueueInput.workflow,
            autoDecision,
            assignedAgentId: enqueueInput.assignedAgentId,
            issueRef: enqueueInput.issueRef,
            submittedTaskId: taskId,
          },
          uiState: nextUiState,
          ...(routingAudit ? { routingAudit } : {}),
          ...(workflowSelectionMeta ? { workflowSelectionMeta } : {}),
        }),
      )
      traceEnqueue('enqueueResolvedTask:sidecarPersisted', {
        taskId,
        elapsedMs: Date.now() - persistStartedAt,
      })

      applyTaskMutationUiState(this.port, nextUiState)
      this.port.trackTaskExecutionProfile(taskId, profile)
      traceEnqueue('enqueueResolvedTask:profileTracked', { taskId })

      const refreshStartedAt = Date.now()
      await finalizeTaskMutation(this.port)
      traceEnqueue('enqueueResolvedTask:stateRefreshed', {
        taskId,
        elapsedMs: Date.now() - refreshStartedAt,
        totalElapsedMs: Date.now() - startedAt,
      })
      return {
        taskId,
        ...(autoDecision ? { autoDecision } : {}),
      }
    } catch (error: unknown) {
      rollbackTaskMutationIfNeeded(this.port, ctx)
      throw error
    }
  }

  retryTask(taskId: string) {
    return this.deriveTask('retry', taskId)
  }

  resumeTask(taskId: string, prompt: string) {
    return this.deriveTask('resume', taskId, prompt)
  }

  async stopTask(taskId: string): Promise<void> {
    if (this.port.mockQueueEnabled()) {
      const task = this.findMockTask(taskId)
      if (!task) throw new Error(`Task not found: ${taskId}`)
      if (task.status !== 'running') {
        throw new Error(`Task ${taskId} is not running (status: ${task.status})`)
      }
      const paths = this.port.requireSidecarPaths()
      const now = new Date().toISOString()
      this.port.mockTasks = this.port.mockTasks.map((current) =>
        current.id === taskId
          ? { ...current, status: 'stopped' as const, updatedAt: now }
          : current,
      )
      await this.port.mockQueueStore.save(paths, this.port.mockTasks)
      await this.port.refreshState()
      return
    }

    const tasks = await this.readTaktTasksFresh()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    if (task.status !== 'running') {
      throw new Error(`Task ${taskId} is not running (status: ${task.status})`)
    }

    const taktRepoPath = this.port.requireTaktRepoPath()
    const config = this.port.requireConfig()
    const resolved = await resolveRunningTaskOwnerPid(taktRepoPath, config, taskId)
    if (resolved.kind === 'not_running') {
      throw new Error(`Task ${taskId} is no longer running (state changed)`)
    }
    if (resolved.kind === 'task_not_found') {
      throw new Error(`Task ${taskId} is no longer running (state changed)`)
    }
    if (resolved.kind === 'no_owner_pid') {
      throw new Error(`No owner process found for running task: ${taskId}`)
    }

    const stopResult = await stopProcessGracefully(resolved.pid)
    if (stopResult === 'timeout') {
      throw new Error(`Process for task ${taskId} did not stop in time`)
    }

    this.port.invalidateTaktTaskYamlCache()
    await this.port.syncWatchConnection(resolved.pid)
    await this.port.refreshState()

    const forceFailed = await reconcileStaleRunningAfterStop(
      taktRepoPath,
      config,
      taskId,
      resolved.pid,
      () => this.readTaktTasksFresh(),
    )
    if (forceFailed) {
      this.port.invalidateTaktTaskYamlCache()
      await this.port.refreshState()
    }
  }

  async resumeStoppedTask(taskId: string): Promise<void> {
    if (!this.port.mockQueueEnabled()) {
      const task = await this.findTaskFromYaml(taskId)
      if (!task) throw new Error(`Task not found: ${taskId}`)
      throw new Error('Resuming stopped tasks is not supported in bundled takt mode yet')
    }
    const task = this.findMockTask(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    if (task.status !== 'stopped') {
      throw new Error(`Task ${taskId} is not stopped (status: ${task.status})`)
    }
    const paths = this.port.requireSidecarPaths()
    const now = new Date().toISOString()
    this.port.mockTasks = this.port.mockTasks.map((current) =>
      current.id === taskId ? { ...current, status: 'running' as const, updatedAt: now } : current,
    )
    await this.port.mockQueueStore.save(paths, this.port.mockTasks)
    await this.port.refreshState()
  }

  reviseTask(taskId: string, prompt: string) {
    return this.deriveTask('revise', taskId, prompt)
  }

  async deleteTask(taskId: string): Promise<void> {
    const paths = this.port.requireSidecarPaths()
    if (this.port.mockQueueEnabled()) {
      this.port.mockTasks = this.port.mockTasks.filter((t) => t.id !== taskId)
      await this.port.mockQueueStore.save(paths, this.port.mockTasks)
      if (this.port.uiState.selectedTaskId === taskId) {
        await this.port.persistUiState({ selectedTaskId: this.port.mockTasks[0]?.id })
      }
    } else {
      const removed = await deletePendingTaskPackage(
        this.port.requireTaktRepoPath(),
        this.port.requireConfig(),
        taskId,
      )
      if (!removed) {
        throw new Error('Only pending tasks can be deleted from the task package')
      }
      this.port.invalidateTaktTaskYamlCache()
      if (this.port.uiState.selectedTaskId === taskId) {
        const remaining = await this.readTaktTasksFresh()
        await this.port.persistUiState({ selectedTaskId: remaining[0]?.id })
      }
    }
    if (paths.sqlitePath) {
      const db = await getSidecarSqlite(paths)
      deleteTaskWorkflowSelectionMeta(db, taskId)
    }
    await this.port.refreshState()
  }

  /**
   * Execute an already-pending task without enqueueing a duplicate. In mock
   * mode it promotes the task to running directly (mirroring `tickMockTasks`).
   * In real mode this is allowed only when the target is the sole pending
   * task (because bundled takt currently runs the whole pending queue), or it
   * schedules the watch fallback if watch is the active processor.
   */
  async runPendingTask(taskId: string, connector: TaktConnectorCli | null): Promise<void> {
    const startedAt = Date.now()
    traceEnqueue('runPendingTask:start', { taskId })

    if (this.port.mockQueueEnabled()) {
      const task = this.findMockTask(taskId)
      if (!task) {
        traceEnqueue('runPendingTask:notFound', { taskId })
        throw new Error(`Task not found: ${taskId}`)
      }
      if (task.status !== 'pending') {
        traceEnqueue('runPendingTask:notPending', { taskId, status: task.status })
        throw new Error(`Task ${taskId} is not pending (status: ${task.status})`)
      }
      const runInput = await this.prepareOllamaExecutionInput(
        taskViewModelToRuntimeEnqueueInput(task),
      )
      await captureRunSupplySnapshot(this.port, taskId, runInput)
      const paths = this.port.requireSidecarPaths()
      const now = new Date().toISOString()
      this.port.mockTasks = this.port.mockTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'running' as const, updatedAt: now } : t,
      )
      await this.port.mockQueueStore.save(paths, this.port.mockTasks)
      await this.port.refreshState()
      traceEnqueue('runPendingTask:mockPromoted', {
        taskId,
        elapsedMs: Date.now() - startedAt,
      })
      return
    }

    if (!connector) {
      throw new Error('Connector unavailable')
    }
    const tasks = await this.readTaktTasksFresh()
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) {
      traceEnqueue('runPendingTask:notFound', { taskId })
      throw new Error(`Task not found: ${taskId}`)
    }
    if (task.status !== 'pending') {
      traceEnqueue('runPendingTask:notPending', { taskId, status: task.status })
      await this.port.refreshState()
      throw new Error(`Task ${taskId} is not pending (status: ${task.status})`)
    }
    this.assertExclusivePendingTask(taskId, tasks)

    const runInput = await this.prepareOllamaExecutionInput(
      taskViewModelToRuntimeEnqueueInput(task),
    )
    if (this.port.connection.watch !== 'running') {
      await captureRunSupplySnapshot(this.port, taskId, runInput)
      await connector.runTaskNow(runInput)
      traceEnqueue('runPendingTask:dispatched', {
        taskId,
        elapsedMs: Date.now() - startedAt,
      })
    } else {
      this.scheduleRunNowWatchFallback({
        taskId,
        resolved: runInput,
        connector,
        taktRepoPath: this.port.requireTaktRepoPath(),
      })
      traceEnqueue('runPendingTask:watchFallbackScheduled', {
        taskId,
        elapsedMs: Date.now() - startedAt,
      })
    }
  }

  async runTaskNow(
    input: EnqueueTaskBridgeInput,
    connector: TaktConnectorCli | null,
  ): Promise<EnqueueTaskResult> {
    const startedAt = Date.now()
    traceEnqueue('runTaskNow:start', summarizeInput(input))
    try {
      const { bridgeInput, autoDecision, routingAudit } =
        await this.prepareEnqueueBridgeInput(input)
      const workflowSelectionMeta = buildWorkflowSelectionMeta(
        input,
        bridgeInput.workflow,
        autoDecision,
        bridgeInput.workflowSelectionKind,
      )
      const resolved = await this.resolveEnqueueBridgeInput(bridgeInput)
      traceEnqueue('runTaskNow:resolved', summarizeInput(resolved))
      if (this.port.mockQueueEnabled() || !connector) {
        const result = await this.enqueueResolvedTask(
          resolved,
          autoDecision,
          routingAudit,
          workflowSelectionMeta,
        )
        traceEnqueue('runTaskNow:mockEnqueueDone', {
          taskId: result.taskId,
          elapsedMs: Date.now() - startedAt,
        })
        return result
      }
      const taktRepoPath = this.port.requireTaktRepoPath()
      const queued = await this.enqueueResolvedTask(
        resolved,
        autoDecision,
        routingAudit,
        workflowSelectionMeta,
      )
      if (this.port.connection.watch !== 'running') {
        await captureRunSupplySnapshot(this.port, queued.taskId, resolved)
        await connector.runTaskNow(resolved)
      } else {
        this.scheduleRunNowWatchFallback({
          taskId: queued.taskId,
          resolved,
          connector,
          taktRepoPath,
        })
      }
      traceEnqueue('runTaskNow:queuedAndDispatched', {
        taskId: queued.taskId,
        watch: this.port.connection.watch,
        fallbackScheduled: this.port.connection.watch === 'running',
      })
      traceEnqueue('runTaskNow:done', { elapsedMs: Date.now() - startedAt })
      return queued
    } catch (error: unknown) {
      traceEnqueue('runTaskNow:error', {
        elapsedMs: Date.now() - startedAt,
        message: summarizeError(error),
      })
      throw error
    }
  }

  private scheduleRunNowWatchFallback(input: {
    taskId: string
    resolved: EnqueueTaskInput
    connector: TaktConnectorCli
    taktRepoPath: string
  }): void {
    const existingTimer = this.runNowWatchFallbackTimers.get(input.taskId)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      this.runNowWatchFallbackTimers.delete(input.taskId)
      void this.runWatchFallbackIfPending(input)
    }, RUN_NOW_WATCH_FALLBACK_MS)
    timer.unref?.()
    this.runNowWatchFallbackTimers.set(input.taskId, timer)
    traceEnqueue('runTaskNow:watchFallbackScheduled', {
      taskId: input.taskId,
      delayMs: RUN_NOW_WATCH_FALLBACK_MS,
    })
  }

  private async runWatchFallbackIfPending(input: {
    taskId: string
    resolved: EnqueueTaskInput
    connector: TaktConnectorCli
    taktRepoPath: string
  }): Promise<void> {
    try {
      if (!this.isCurrentTaktRepo(input.taktRepoPath)) {
        traceEnqueue('runTaskNow:watchFallbackSkipped', {
          taskId: input.taskId,
          reason: 'workspace_changed',
        })
        return
      }
      const tasks = await this.port.readTaktTasksFreshAt(input.taktRepoPath)
      const task = tasks.find((candidate) => candidate.id === input.taskId)
      if (!task || task.status !== 'pending') {
        traceEnqueue('runTaskNow:watchFallbackSkipped', {
          taskId: input.taskId,
          status: task?.status ?? 'missing',
        })
        return
      }
      traceEnqueue('runTaskNow:watchFallbackDispatch', { taskId: input.taskId })
      this.assertExclusivePendingTask(input.taskId, tasks)
      const runInput = await this.prepareOllamaExecutionInput(input.resolved)
      await captureRunSupplySnapshot(this.port, input.taskId, runInput)
      await input.connector.runTaskNow(runInput)
      traceEnqueue('runTaskNow:watchFallbackDone', { taskId: input.taskId })
    } catch (error: unknown) {
      traceEnqueue('runTaskNow:watchFallbackError', {
        taskId: input.taskId,
        message: summarizeError(error),
      })
    }
  }

  private isCurrentTaktRepo(expectedRepoPath: string): boolean {
    try {
      return this.port.requireTaktRepoPath() === expectedRepoPath
    } catch {
      return false
    }
  }

  private assertExclusivePendingTask(taskId: string, tasks: TaskViewModel[]): void {
    if (this.port.mockQueueEnabled()) return
    const pendingIds = tasks.filter((task) => task.status === 'pending').map((task) => task.id)
    if (pendingIds.length > 1) {
      throw new Error(
        `Cannot run pending task ${taskId} alone because ${pendingIds.length} tasks are pending; run all pending tasks instead.`,
      )
    }
  }

  listConversations(taskId: string) {
    const paths = this.port.requireSidecarPaths()
    return this.port.conversationStore.listForTask(paths, taskId)
  }

  listPromptHistory(limit?: number) {
    if (!this.port.sidecarPaths) return Promise.resolve([])
    return this.port.promptHistoryStore.list(this.port.sidecarPaths, limit)
  }

  deletePromptHistoryItem(id: string) {
    if (!this.port.sidecarPaths) return Promise.resolve()
    return this.port.promptHistoryStore.deleteItem(this.port.sidecarPaths, id)
  }

  private async deriveTask(
    kind: 'retry' | 'resume' | 'revise',
    taskId: string,
    prompt?: string,
  ): Promise<{ taskId: string }> {
    const ctx = prepareTaskMutationContext(this.port)
    let nextId: string
    let origin: TaskViewModel
    try {
      if (this.port.mockQueueEnabled()) {
        const mockOrigin = this.findMockTask(taskId)
        if (!mockOrigin) throw new Error(`Task not found: ${taskId}`)
        origin = mockOrigin
        await this.prepareOllamaExecutionInput(buildDeriveEnqueueInput(origin, kind, prompt))
        const existing = new Set(this.port.mockTasks.map((t) => t.id))
        const next = createDerivedTask({ kind, origin, prompt, existingIds: existing })
        this.port.mockTasks = [next, ...this.port.mockTasks]
        nextId = next.id
      } else if (this.port.connector) {
        const tasks = await this.readTaktTasksFresh()
        const yamlOrigin = tasks.find((candidate) => candidate.id === taskId)
        if (!yamlOrigin) throw new Error(`Task not found: ${taskId}`)
        origin = yamlOrigin
        const existing = this.port.taktTaskIdSet(tasks)
        const execInput = await this.prepareOllamaExecutionInput(
          buildDeriveEnqueueInput(origin, kind, prompt),
        )
        const result = await this.port.connector.enqueueTask(execInput, existing)
        nextId = result.taskId
        this.port.invalidateTaktTaskYamlCache()
      } else {
        throw new Error('Connector unavailable')
      }

      const inheritedExecutorId = this.port.uiState.taskAssignments?.[taskId]
      const nextUiState: UiState = {
        ...this.port.uiState,
        selectedTaskId: nextId,
        ...(inheritedExecutorId
          ? { taskAssignments: mergeTaskAssignment(this.port.uiState, nextId, inheritedExecutorId) }
          : {}),
      }

      await persistTaskMutationSideEffects(ctx, () =>
        persistDeriveSidecar(ctx.paths, {
          mode: this.port.mockQueueEnabled() ? 'mock' : 'production',
          ...(this.port.mockQueueEnabled() ? { mockTasks: this.port.mockTasks } : {}),
          conversation: {
            taskId: nextId,
            role: 'user',
            kind,
            body: prompt ?? origin.body ?? origin.title,
          },
          retryContext: {
            taskId: nextId,
            originTaskId: origin.id,
            kind,
            prompt,
            branch: origin.sourceBranch,
            createdAt: new Date().toISOString(),
          },
          uiState: nextUiState,
        }),
      )

      applyTaskMutationUiState(this.port, nextUiState)
      await finalizeTaskMutation(this.port)
      return { taskId: nextId }
    } catch (error: unknown) {
      rollbackTaskMutationIfNeeded(this.port, ctx)
      throw error
    }
  }

  private readTaktTasksFresh(): Promise<TaskViewModel[]> {
    return this.port.readTaktTasksFresh()
  }

  private findMockTask(taskId: string): TaskViewModel | undefined {
    return this.port.mockTasks.find((t) => t.id === taskId)
  }

  private async findTaskFromYaml(taskId: string): Promise<TaskViewModel | undefined> {
    if (this.port.mockQueueEnabled()) {
      return this.findMockTask(taskId)
    }
    if (!this.port.workspacePath || !this.port.config) return undefined
    const tasks = await this.readTaktTasksFresh()
    return tasks.find((t) => t.id === taskId)
  }
}
