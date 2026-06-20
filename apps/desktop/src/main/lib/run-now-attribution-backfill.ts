import type { ExecutionProfile, TaskViewModel, UiState } from '@planetz/shared'
import { mergeTaskAssignment } from './ui-state-task-assignments.js'

export interface PendingRunNowAttribution {
  workflow: string
  title: string
  executorId?: string
  profile?: ExecutionProfile
  at: string
}

export interface RunNowBackfillResult {
  taskAssignments?: Record<string, string>
  matchedTaskId?: string
  clearPending: boolean
}

export function tryBackfillRunNowAssignment(
  tasks: TaskViewModel[],
  pending: PendingRunNowAttribution | null | undefined,
  uiState: UiState,
): RunNowBackfillResult {
  if (!pending?.executorId) {
    return { clearPending: Boolean(pending) }
  }

  const pendingAt = Date.parse(pending.at)
  let candidates = tasks.filter((t) => {
    if (t.status !== 'running') return false
    if (t.workflow !== pending.workflow) return false
    if (!Number.isNaN(pendingAt) && Date.parse(t.createdAt) < pendingAt) return false
    return true
  })

  if (candidates.length > 1) {
    const titleNeedle = pending.title.trim()
    if (titleNeedle) {
      const byTitle = candidates.filter((t) => t.title.trim() === titleNeedle)
      if (byTitle.length === 1) {
        candidates = byTitle
      }
    }
  }

  if (candidates.length !== 1) {
    return { clearPending: false }
  }

  const matched = candidates[0]
  return {
    taskAssignments: mergeTaskAssignment(uiState, matched.id, pending.executorId),
    matchedTaskId: matched.id,
    clearPending: true,
  }
}
