import {
  formatIssueRefKey,
  type GitHubIssueRepository,
  normalizeIssueRef,
  type PromptHistoryItem,
  resolveTaskIssueNumber,
  resolveTaskIssueRef,
  type TaskViewModel,
} from '@planetz/shared'
import { useMemo } from 'react'
import { useAppStore } from '../store/app-store.js'

export type IssueTaskActivity = {
  totalCount: number
  runningCount: number
  /** Tasks sitting in the pending queue (status === 'pending') for this issue. */
  queuedCount: number
}

const EMPTY_ACTIVITY: IssueTaskActivity = { totalCount: 0, runningCount: 0, queuedCount: 0 }

function issueKey(number: number): string {
  return `issue:${number}`
}

/** Stable empty array for store selectors (avoids new [] each render). */
export const EMPTY_TASKS: readonly TaskViewModel[] = []

export function useWorkspaceTasks(): readonly TaskViewModel[] {
  return useAppStore((s) => s.state?.tasks ?? EMPTY_TASKS)
}

export function usePromptHistoryItems(): readonly PromptHistoryItem[] {
  return useAppStore((s) => s.promptHistory)
}

export function useIssueTaskActivityIndex(
  tasks: readonly TaskViewModel[],
  promptHistory: readonly PromptHistoryItem[],
): Map<string, IssueTaskActivity> {
  return useMemo(() => indexIssueTaskActivity(tasks, promptHistory), [promptHistory, tasks])
}

export function indexIssueTaskActivity(
  tasks: readonly TaskViewModel[],
  promptHistory: readonly PromptHistoryItem[] = [],
): Map<string, IssueTaskActivity> {
  const index = new Map<string, IssueTaskActivity>()
  const currentTaskIds = new Set(tasks.map((task) => task.id))
  const issueRefByTaskId = new Map<string, string>()
  const deletedHistoryTaskIds = new Set<string>()

  for (const item of promptHistory) {
    const issueRef = normalizeIssueRef(item.issueRef)
    const taskId = item.submittedTaskId?.trim()
    if (!issueRef || !taskId || issueRefByTaskId.has(taskId)) continue
    issueRefByTaskId.set(taskId, issueRef)
  }

  for (const task of tasks) {
    const issueRef = resolveTaskIssueRef(task) ?? issueRefByTaskId.get(task.id)
    if (!issueRef) {
      const issueNumber = resolveTaskIssueNumber(task)
      if (!issueNumber) continue
      const key = issueKey(issueNumber)
      const current = index.get(key) ?? EMPTY_ACTIVITY
      index.set(key, {
        totalCount: current.totalCount + 1,
        runningCount: current.runningCount + (task.status === 'running' ? 1 : 0),
        queuedCount: current.queuedCount + (task.status === 'pending' ? 1 : 0),
      })
      continue
    }
    const current = index.get(issueRef) ?? EMPTY_ACTIVITY
    index.set(issueRef, {
      totalCount: current.totalCount + 1,
      runningCount: current.runningCount + (task.status === 'running' ? 1 : 0),
      queuedCount: current.queuedCount + (task.status === 'pending' ? 1 : 0),
    })
  }

  for (const item of promptHistory) {
    const issueRef = normalizeIssueRef(item.issueRef)
    const taskId = item.submittedTaskId?.trim()
    if (!issueRef || !taskId || currentTaskIds.has(taskId) || deletedHistoryTaskIds.has(taskId)) {
      continue
    }
    deletedHistoryTaskIds.add(taskId)
    const current = index.get(issueRef) ?? EMPTY_ACTIVITY
    index.set(issueRef, {
      totalCount: current.totalCount + 1,
      runningCount: current.runningCount,
      queuedCount: current.queuedCount,
    })
  }
  return index
}

function issueRefKey(repository: GitHubIssueRepository, number: number): string {
  return formatIssueRefKey(repository, number)
}

export function issueTaskActivityForRef(
  index: Map<string, IssueTaskActivity>,
  repository: GitHubIssueRepository,
  number: number,
): IssueTaskActivity {
  const exact = index.get(issueRefKey(repository, number))
  if (exact) return exact
  const legacy = index.get(issueKey(number))
  return legacy ?? EMPTY_ACTIVITY
}
