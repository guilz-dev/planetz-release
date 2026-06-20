import type { UiState } from '@planetz/shared'

export function mergeTaskAssignment(
  uiState: UiState,
  taskId: string,
  executorId: string,
): Record<string, string> {
  return {
    ...(uiState.taskAssignments ?? {}),
    [taskId]: executorId,
  }
}
