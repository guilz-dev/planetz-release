import type { TaskReportArtifact, TaskViewModel } from '@planetz/shared'

export const SPEC_ARTIFACT_HINTS = ['requirements', 'design', 'tasks'] as const

export function filterSpecArtifacts(reports: TaskReportArtifact[]): TaskReportArtifact[] {
  return reports.filter((report) => {
    const name = report.fileName.toLowerCase()
    return SPEC_ARTIFACT_HINTS.some((hint) => name.includes(hint))
  })
}

/** Picks the linked completed task with the latest `updatedAt`. */
export function pickLatestCompletedTaskId(
  taskIds: readonly string[],
  tasks: readonly TaskViewModel[],
): string | null {
  if (taskIds.length === 0) return null
  const byId = new Map(tasks.map((task) => [task.id, task]))
  let latest: TaskViewModel | null = null
  for (const taskId of taskIds) {
    const task = byId.get(taskId)
    if (task?.status !== 'completed') continue
    if (!latest || task.updatedAt > latest.updatedAt) latest = task
  }
  return latest?.id ?? null
}
