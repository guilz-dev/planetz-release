import { basename } from 'node:path'
import type {
  AgentState,
  AppState,
  ChainGroup,
  ConnectionState,
  IntegrationsState,
  TaskViewModel,
  UiState,
  WorkspaceBootstrapStatus,
  WorkspaceState,
} from '@planetz/shared'
import { deriveTaskFailure, resolveTaskFailure } from '../lib/projection/failure-projection.js'
import {
  applyTaskAssignments,
  projectResultSummaries,
  resolveSelectedTaskId,
  sortTasksByCreatedAtDesc,
} from '../lib/projection/task-projection.js'
import { classifyWorkspaceBootstrap } from '../lib/workspace-bootstrap.js'
import { MOCK_AGENTS } from './mock-data.js'
import { getMockFailureEvents } from './run-events-mock.js'
import { MOCK_WORKFLOWS } from './workflows-mock.js'

export interface MockProjectionInput {
  workspacePath: string
  sidecarPath: string
  isWritable: boolean
  uiState: UiState
  connection: ConnectionState
  mockTasks: TaskViewModel[]
  chains: ChainGroup[]
  integrations: IntegrationsState
  agents?: AgentState[]
  /** Optional dev-only override for §9.1 bootstrap state. */
  bootstrapOverride?: WorkspaceBootstrapStatus
}

export function projectMockAppState(input: MockProjectionInput): AppState {
  const bootstrap =
    input.bootstrapOverride ?? classifyWorkspaceBootstrap(input.workspacePath, input.sidecarPath)
  const workspace: WorkspaceState = {
    id: Buffer.from(input.workspacePath).toString('base64url').slice(0, 16),
    name: basename(input.workspacePath),
    path: input.workspacePath,
    sidecarPath: input.sidecarPath,
    isWritable: input.isWritable,
    bootstrap,
  }

  const tasksRaw = applyTaskAssignments(input.mockTasks, input.uiState)
  const tasks = sortTasksByCreatedAtDesc(
    tasksRaw.map((task) => {
      if (task.status !== 'failed' && task.status !== 'exceeded') return task
      const events = getMockFailureEvents(task.id)
      const failure = resolveTaskFailure(task, deriveTaskFailure(events, task.status))
      return failure ? { ...task, failure } : task
    }),
  )
  const retries = tasks.filter((t) => t.status === 'failed' || t.status === 'exceeded')

  const agents = input.agents ?? MOCK_AGENTS
  const executors = agents.map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    runtime: agent.runtime,
    status: agent.status,
    activeTaskIds: agent.currentTaskId ? [agent.currentTaskId] : [],
    ...(agent.currentRunId ? { activeRunIds: [agent.currentRunId] } : {}),
    updatedAt: agent.updatedAt,
  }))

  return {
    workspace,
    mockQueueEnabled: true,
    connection: input.connection,
    agents,
    executors,
    workflows: MOCK_WORKFLOWS,
    tasks,
    retries,
    results: projectResultSummaries(tasks),
    selectedTaskId: resolveSelectedTaskId(tasks, input.uiState),
    chains: input.chains,
    integrations: input.integrations,
  }
}
