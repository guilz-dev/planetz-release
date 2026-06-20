import type {
  AgentOverrides,
  EngineConfig,
  ExecutionProfile,
  RunEvent,
  TaskExecutionAttribution,
  TaskViewModel,
  UiState,
  WorkflowSummary,
} from '@planetz/shared'
import { resolveTaskExecutionAttribution } from '@planetz/shared'

export interface AttachTaskAttributionsInput {
  tasks: TaskViewModel[]
  workflows: WorkflowSummary[]
  uiState: UiState
  pendingProfilesByTaskId: ReadonlyMap<string, ExecutionProfile>
  engine: EngineConfig
  agentOverrides: AgentOverrides
  runEventsByTaskId: ReadonlyMap<string, RunEvent[]>
}

export function attachTaskAttributions(input: AttachTaskAttributionsInput): TaskViewModel[] {
  const {
    tasks,
    workflows,
    uiState,
    pendingProfilesByTaskId,
    engine,
    agentOverrides,
    runEventsByTaskId,
  } = input

  return tasks.map((task) => {
    if (task.status !== 'running') {
      return task
    }
    const workflow = workflows.find((w) => w.name === task.workflow)
    const taskAssignmentExecutorId = uiState.taskAssignments?.[task.id]
    const executionProfile = pendingProfilesByTaskId.get(task.id)
    const executorAttribution: TaskExecutionAttribution = resolveTaskExecutionAttribution({
      taskId: task.id,
      status: task.status,
      activeStep: task.activeStep,
      activeRunId: task.activeRunId,
      workflow,
      assignedAgentId: task.assignedAgentId,
      taskAssignmentExecutorId,
      executionProfile,
      engine,
      agentOverrides,
      runEvents: runEventsByTaskId.get(task.id),
    })
    return { ...task, executorAttribution }
  })
}
