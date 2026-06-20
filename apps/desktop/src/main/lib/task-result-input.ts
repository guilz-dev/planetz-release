import type { AppState, TaskViewModel, UiConfig } from '@planetz/shared'

export interface ResolveTaskResultInput {
  taktRepoPath: string
  workspacePath: string | null
  config: UiConfig
  taskId: string
  assignedAgentId?: string
  readWorkflowYaml: (workflowName: string) => Promise<string | null>
}

/** Minimal session surface for building {@link ResolveTaskResultInput}. */
export interface TaskResultInputSource {
  mockQueueEnabled(): boolean
  workspacePath: string | null
  config: UiConfig | null
  cachedTasks(): TaskViewModel[]
  requireTaktRepoPath(): string
  readWorkflowYaml(workflowName: string): Promise<string | null>
}

export function buildResolveTaskResultInput(
  source: TaskResultInputSource,
  taskId: string,
): ResolveTaskResultInput | null {
  if (source.mockQueueEnabled()) return null
  if (!source.config) return null
  try {
    const task = source.cachedTasks().find((entry) => entry.id === taskId)
    const executorId = task?.executorAttribution?.executorId ?? task?.assignedAgentId
    return {
      taktRepoPath: source.requireTaktRepoPath(),
      workspacePath: source.workspacePath,
      config: source.config,
      taskId,
      assignedAgentId: executorId,
      readWorkflowYaml: source.readWorkflowYaml,
    }
  } catch {
    return null
  }
}

/** Adapter for {@link AppSession} and session services. */
export function taskResultInputSourceFromSession(session: {
  mockQueueEnabled(): boolean
  workspacePath: string | null
  config: UiConfig | null
  cachedState: AppState | null
  requireTaktRepoPath(): string
  workflowManager: { read(workflowName: string): { yaml: string } | Promise<{ yaml: string }> }
}): TaskResultInputSource {
  return {
    mockQueueEnabled: () => session.mockQueueEnabled(),
    workspacePath: session.workspacePath,
    config: session.config,
    cachedTasks: () => session.cachedState?.tasks ?? [],
    requireTaktRepoPath: () => session.requireTaktRepoPath(),
    readWorkflowYaml: async (workflowName) => {
      try {
        const { yaml } = await session.workflowManager.read(workflowName)
        return yaml
      } catch {
        return null
      }
    },
  }
}
