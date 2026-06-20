import type { TaskViewModel } from '@planetz/shared'
import { advanceMockRunSeeds, ensureMockRunSeed, hasMockRunSeed } from './run-events-mock.js'

export interface TickMockTasksOptions {
  /** Workflow step names keyed by workflow name (for dynamic run seeds). */
  stepNamesByWorkflow?: ReadonlyMap<string, readonly string[]>
}

/**
 * Returns a copy of `tasks` with one running task's `updatedAt` ticked forward
 * and one pending task promoted to running when no running task exists and no
 * task is stopped. The animator is intentionally low-energy: it exists so the UI
 * proves it reacts to state updates without dominating CPU. No new tasks are created.
 *
 * When `stepNamesByWorkflow` is provided, running tasks get mock run seeds and
 * their workflow cursor advances on each tick (drives `activeStep` in the UI).
 */
export function tickMockTasks(
  tasks: TaskViewModel[],
  options?: TickMockTasksOptions,
): TaskViewModel[] {
  const now = new Date().toISOString()
  const stepNamesByWorkflow = options?.stepNamesByWorkflow

  let next = tasks
  const runningIdx = next.findIndex((t) => t.status === 'running')
  if (runningIdx >= 0) {
    next = [...next]
    next[runningIdx] = { ...next[runningIdx], updatedAt: now }
  } else if (!next.some((t) => t.status === 'stopped')) {
    const pendingIdx = next.findIndex((t) => t.status === 'pending')
    if (pendingIdx >= 0) {
      next = [...next]
      next[pendingIdx] = { ...next[pendingIdx], status: 'running', updatedAt: now }
    }
  }

  if (stepNamesByWorkflow) {
    syncMockRunTimeline(next, stepNamesByWorkflow)
  }

  return next
}

function syncMockRunTimeline(
  tasks: TaskViewModel[],
  stepNamesByWorkflow: ReadonlyMap<string, readonly string[]>,
): void {
  const runningIds = new Set<string>()
  const newlySeeded = new Set<string>()
  for (const task of tasks) {
    if (task.status !== 'running') continue
    runningIds.add(task.id)
    const workflowName = task.workflow ?? 'default'
    const stepNames = stepNamesByWorkflow.get(workflowName) ?? stepNamesByWorkflow.get('default')
    if (!stepNames?.length) continue
    if (!hasMockRunSeed(task.id)) {
      ensureMockRunSeed(task.id, stepNames)
      newlySeeded.add(task.id)
    }
  }
  const advanceIds = new Set([...runningIds].filter((id) => !newlySeeded.has(id)))
  if (advanceIds.size > 0) {
    advanceMockRunSeeds(advanceIds)
  }
}
