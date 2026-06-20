import type { AppState, ResultSummary, TaskViewModel, UiState } from '@planetz/shared'

const TERMINAL_STATUSES = new Set<TaskViewModel['status']>(['completed', 'failed', 'exceeded'])

/** Newest `createdAt` first; stable tie-break on task id. */
export function compareTasksByCreatedAtDesc(a: TaskViewModel, b: TaskViewModel): number {
  const aTime = Date.parse(a.createdAt)
  const bTime = Date.parse(b.createdAt)
  const aValid = !Number.isNaN(aTime)
  const bValid = !Number.isNaN(bTime)
  if (aValid && bValid && aTime !== bTime) return bTime - aTime
  if (aValid !== bValid) return aValid ? -1 : 1
  return a.id.localeCompare(b.id)
}

export function sortTasksByCreatedAtDesc(tasks: TaskViewModel[]): TaskViewModel[] {
  return [...tasks].sort(compareTasksByCreatedAtDesc)
}

export function projectResultSummaries(tasks: TaskViewModel[]): ResultSummary[] {
  return tasks
    .filter((t) => TERMINAL_STATUSES.has(t.status))
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      status: t.status as 'completed' | 'failed' | 'exceeded',
      completedAt: t.updatedAt,
      branch: t.sourceBranch,
    }))
}

export function applyTaskAssignments(tasks: TaskViewModel[], uiState: UiState): TaskViewModel[] {
  return tasks.map((task) => ({
    ...task,
    assignedAgentId: uiState.taskAssignments?.[task.id] ?? task.assignedAgentId,
  }))
}

export function resolveSelectedTaskId(
  tasks: TaskViewModel[],
  uiState: UiState,
): string | undefined {
  // Explicit empty string = user actively cleared the selection.
  if (uiState.selectedTaskId === '') return undefined
  const taskIds = new Set(tasks.map((t) => t.id))
  if (uiState.selectedTaskId && taskIds.has(uiState.selectedTaskId)) {
    return uiState.selectedTaskId
  }
  return undefined
}

/** Keep cached AppState.selection in sync after ui-state-only persistence. */
export function syncCachedSelectedTaskId(
  state: AppState,
  uiState: UiState,
  tasks: TaskViewModel[],
): AppState {
  return {
    ...state,
    tasks,
    selectedTaskId: resolveSelectedTaskId(tasks, uiState),
  }
}
