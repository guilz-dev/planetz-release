import { basename } from 'node:path'
import {
  type AgentOverrides,
  type AgentState,
  type AppState,
  type ChainGroup,
  type ConnectionState,
  type EngineConfig,
  type ExecutionProfile,
  type IntegrationsState,
  isTerminalTaskStatus,
  type RunEvent,
  type SddOpenSnapshot,
  type TaskViewModel,
  type UiConfig,
  type UiState,
  type WorkflowSummary,
  type WorkspaceBootstrapStatus,
  type WorkspaceState,
} from '@planetz/shared'
import { attachTaskAttributions } from './lib/projection/executor-attribution-projection.js'
import {
  executorsToAgentStates,
  projectExecutorsFromAttributions,
} from './lib/projection/executor-projection.js'
import { deriveTaskFailure, resolveTaskFailure } from './lib/projection/failure-projection.js'
import {
  indexRunEventsByTaskId,
  indexRunTracesByTaskId,
  projectTaskRunHighlight,
  runTracesForTaskHighlight,
} from './lib/projection/run-projection.js'
import { mergeTaskLiveActivityProjection } from './lib/projection/task-execution-activity-projection.js'
import { projectTaskExecutionStatus } from './lib/projection/task-execution-status-projection.js'
import {
  applyTaskAssignments,
  projectResultSummaries,
  resolveSelectedTaskId,
  sortTasksByCreatedAtDesc,
} from './lib/projection/task-projection.js'
import { projectWorkflowStepActivities } from './lib/projection/workflow-step-activity-projection.js'
import { runEventsFromTraces } from './lib/run-events-from-traces.js'
import { collectRunTraces } from './lib/run-trace-parser.js'
import type { RunTraceEvent } from './lib/run-trace-types.js'
import { readTaskRunEventSources } from './lib/tasks-yaml-reader.js'
import { classifyWorkspaceBootstrap } from './lib/workspace-bootstrap.js'

/**
 * Normalizes a workflow identifier that may be a file path
 * (e.g. '.planetz/orbit/runtime-workflows/default.yaml')
 * or a short name (e.g. 'default') to the base name without extension, matching WorkflowSummary.name.
 */
function normalizeWorkflowName(workflow: string | undefined): string | undefined {
  const trimmed = workflow?.trim()
  if (!trimmed) return undefined
  if (!trimmed.includes('/')) return trimmed
  const last = trimmed.split('/').filter(Boolean).at(-1) ?? trimmed
  return last.replace(/\.(yaml|yml)$/i, '') || trimmed
}

export interface ProjectionInput {
  workspacePath: string
  taktExecutionPath?: string
  sidecarPath: string
  isWritable: boolean
  config: UiConfig
  uiState: UiState
  connection: ConnectionState
  tasks: TaskViewModel[]
  workflows: WorkflowSummary[]
  builtinWorkflowCategoryOrder?: string[]
  executorTemplates: AgentState[]
  engine: EngineConfig
  agentOverrides: AgentOverrides
  pendingProfilesByTaskId: ReadonlyMap<string, ExecutionProfile>
  chains: ChainGroup[]
  integrations: IntegrationsState
  /** Time-ordered ascending by `at` (same as `collectRunEvents`). */
  runEvents: RunEvent[]
  /** Time-ordered ascending by `at` (same as `collectRunTraces`). */
  runTraces: RunTraceEvent[]
  bootstrapOverride?: WorkspaceBootstrapStatus
  mockQueueEnabled?: boolean
  sddOpen?: SddOpenSnapshot | null
}

export async function buildProductionProjection(
  input: Omit<ProjectionInput, 'tasks' | 'runEvents' | 'runTraces'> & {
    tasksFromYaml: TaskViewModel[]
  },
): Promise<{ state: AppState; runEvents: RunEvent[]; runTraces: RunTraceEvent[] }> {
  const taktPath = input.taktExecutionPath ?? input.workspacePath
  const runSources = await readTaskRunEventSources(taktPath, input.config)
  const runTraces = await collectRunTraces(
    taktPath,
    input.config,
    runSources.runDirSlugToTaskId,
    runSources.additionalRunRoots,
  )
  const runEvents = runEventsFromTraces(runTraces)
  const state = projectAppState({ ...input, tasks: input.tasksFromYaml, runEvents, runTraces })
  return { state, runEvents, runTraces }
}

export function projectAppState(input: ProjectionInput): AppState {
  const bootstrap =
    input.bootstrapOverride ?? classifyWorkspaceBootstrap(input.workspacePath, input.sidecarPath)
  const workspace: WorkspaceState = {
    id: Buffer.from(input.workspacePath).toString('base64url').slice(0, 16),
    name: basename(input.workspacePath),
    path: input.workspacePath,
    sidecarPath: input.sidecarPath,
    isWritable: input.isWritable,
    bootstrap,
    ...(input.taktExecutionPath ? { taktExecutionPath: input.taktExecutionPath } : {}),
  }

  const runEventsByTaskId = indexRunEventsByTaskId(input.runEvents)
  const runTracesByTaskId = indexRunTracesByTaskId(input.runTraces)

  const tasksWithSteps = applyTaskAssignments(input.tasks, input.uiState).map((task) => {
    const workflowName = normalizeWorkflowName(task.workflow)
    const workflow = workflowName ? input.workflows.find((w) => w.name === workflowName) : undefined
    const byTask = runEventsByTaskId.get(task.id) ?? []
    const byTaskTraces = runTracesByTaskId.get(task.id) ?? []
    const pinnedRunId = input.uiState.activeRunByTaskId?.[task.id]
    const stepNames = workflow?.stepNames ?? []
    const terminal = isTerminalTaskStatus(task.status)
    const { activeRunId, activeStep } = terminal
      ? { activeRunId: undefined, activeStep: undefined }
      : projectTaskRunHighlight(byTask, pinnedRunId, stepNames)

    if (task.status !== 'running') {
      return {
        ...task,
        activeStep,
        activeRunId,
      }
    }

    const scopedTraces = runTracesForTaskHighlight(byTaskTraces, pinnedRunId)
    const workflowStepActivities =
      stepNames.length > 0
        ? projectWorkflowStepActivities(scopedTraces, stepNames, activeRunId)
        : undefined
    const liveActivity = mergeTaskLiveActivityProjection(scopedTraces, workflowStepActivities)
    const executionStatus = projectTaskExecutionStatus(
      scopedTraces,
      { activeRunId, activeStep },
      liveActivity,
    )

    return {
      ...task,
      activeStep,
      activeRunId,
      ...(liveActivity.length > 0 ? { liveActivity } : {}),
      ...(executionStatus ? { executionStatus } : {}),
      ...(workflowStepActivities?.length ? { workflowStepActivities } : {}),
    }
  })

  const tasksWithAttribution = attachTaskAttributions({
    tasks: tasksWithSteps,
    workflows: input.workflows,
    uiState: input.uiState,
    pendingProfilesByTaskId: input.pendingProfilesByTaskId,
    engine: input.engine,
    agentOverrides: input.agentOverrides,
    runEventsByTaskId: runEventsByTaskId,
  })

  const tasks = sortTasksByCreatedAtDesc(
    tasksWithAttribution.map((task) => {
      if (task.status !== 'failed' && task.status !== 'exceeded') return task
      const byTask = runEventsByTaskId.get(task.id) ?? []
      const fromEvents = deriveTaskFailure(byTask, task.status)
      const failure = resolveTaskFailure(task, fromEvents)
      return failure ? { ...task, failure } : task
    }),
  )

  const executors = projectExecutorsFromAttributions(input.executorTemplates, tasks)
  const templateById = new Map(input.executorTemplates.map((t) => [t.id, t]))
  const agents = executorsToAgentStates(executors, templateById)

  const retries = tasks.filter((t) => t.status === 'failed' || t.status === 'exceeded')

  return {
    workspace,
    mockQueueEnabled: input.mockQueueEnabled ?? false,
    connection: input.connection,
    agents,
    executors,
    workflows: input.workflows,
    builtinWorkflowCategoryOrder: input.builtinWorkflowCategoryOrder,
    tasks,
    retries,
    results: projectResultSummaries(tasks),
    selectedTaskId: resolveSelectedTaskId(tasks, input.uiState),
    chains: input.chains,
    integrations: input.integrations,
    ...(input.sddOpen ? { sddOpen: input.sddOpen } : {}),
  }
}
