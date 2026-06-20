import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TaskViewModel, UiConfig } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { isProcessAlive } from './process-alive.js'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

/** Wait after SIGINT before escalating (ms). */
const STOP_SIGNAL_GRACEFUL_MS = 3000
/** Wait after SIGTERM before SIGKILL (ms). */
const STOP_SIGNAL_TERM_MS = 2000
/** Poll interval while waiting for takt to update tasks.yaml after stop (ms). */
const STALE_RUNNING_POLL_MS = 400
/** Max polls before force-fail when task stays running (count). */
const STALE_RUNNING_POLL_ATTEMPTS = 8

export const FORCE_FAIL_USER_MESSAGE = 'Stopped by user from Planetz'

export type StopProcessResult = 'stopped' | 'not_found' | 'timeout'

export type ResolveRunningTaskOwnerPidResult =
  | { kind: 'ok'; pid: number }
  | { kind: 'task_not_found' }
  | { kind: 'not_running' }
  | { kind: 'no_owner_pid' }

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

function tasksYamlPath(taktRepoPath: string, config: UiConfig): string {
  return join(taktRepoPath, config.tasksYamlPath)
}

function isRawStatusRunning(status: unknown): boolean {
  if (typeof status !== 'string') return false
  return status.trim().toLowerCase() === 'running'
}

function coerceOwnerPid(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  process.kill(pid, signal)
}

function isProcessNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ESRCH'
  )
}

export async function resolveRunningTaskOwnerPid(
  taktRepoPath: string,
  config: UiConfig,
  taskId: string,
): Promise<ResolveRunningTaskOwnerPidResult> {
  const yamlPath = tasksYamlPath(taktRepoPath, config)
  return withTasksYamlLock(yamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(yamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return { kind: 'task_not_found' }
    }
    if (!Array.isArray(root.tasks)) return { kind: 'task_not_found' }

    const row = root.tasks.find((t) => t.name === taskId)
    if (!row) return { kind: 'task_not_found' }
    if (!isRawStatusRunning(row.status)) return { kind: 'not_running' }

    const pid = coerceOwnerPid(row.owner_pid)
    if (pid === null) return { kind: 'no_owner_pid' }
    return { kind: 'ok', pid }
  })
}

export async function stopProcessGracefully(pid: number): Promise<StopProcessResult> {
  if (!isProcessAlive(pid)) return 'not_found'

  try {
    sendSignal(pid, 'SIGINT')
  } catch (error: unknown) {
    if (isProcessNotFoundError(error)) return 'not_found'
    throw error
  }

  if (!(await waitForExit(pid, STOP_SIGNAL_GRACEFUL_MS))) return 'stopped'

  if (!isProcessAlive(pid)) return 'not_found'

  try {
    sendSignal(pid, 'SIGTERM')
  } catch (error: unknown) {
    if (isProcessNotFoundError(error)) return 'not_found'
    throw error
  }

  if (!(await waitForExit(pid, STOP_SIGNAL_TERM_MS))) return 'stopped'

  if (!isProcessAlive(pid)) return 'not_found'

  try {
    sendSignal(pid, 'SIGKILL')
  } catch (error: unknown) {
    if (isProcessNotFoundError(error)) return 'not_found'
    throw error
  }

  if (!(await waitForExit(pid, STOP_SIGNAL_TERM_MS))) return 'stopped'
  return 'timeout'
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return false
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await sleep(Math.min(STALE_RUNNING_POLL_MS, remaining))
  }
  return isProcessAlive(pid)
}

export async function forceFailRunningTask(
  taktRepoPath: string,
  config: UiConfig,
  taskId: string,
  reason: string = FORCE_FAIL_USER_MESSAGE,
): Promise<boolean> {
  const yamlPath = tasksYamlPath(taktRepoPath, config)
  return withTasksYamlLock(yamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(yamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return false
    }
    if (!Array.isArray(root.tasks)) return false

    const row = root.tasks.find((t) => t.name === taskId && isRawStatusRunning(t.status))
    if (!row) return false

    const completedAt = new Date().toISOString()
    row.status = 'failed'
    row.completed_at = completedAt
    delete row.owner_pid

    const failure =
      typeof row.failure === 'object' && row.failure !== null && !Array.isArray(row.failure)
        ? (row.failure as Record<string, unknown>)
        : {}
    failure.error = reason
    row.failure = failure

    await writeFile(yamlPath, stringifyYaml(root), 'utf8')
    return true
  })
}

export async function reconcileStaleRunningAfterStop(
  taktRepoPath: string,
  config: UiConfig,
  taskId: string,
  stoppedPid: number,
  readFresh: () => Promise<TaskViewModel[]>,
): Promise<boolean> {
  if (isProcessAlive(stoppedPid)) return false

  for (let attempt = 0; attempt < STALE_RUNNING_POLL_ATTEMPTS; attempt += 1) {
    await sleep(STALE_RUNNING_POLL_MS)
    const tasks = await readFresh()
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status !== 'running') return false
  }

  return forceFailRunningTask(taktRepoPath, config, taskId)
}
