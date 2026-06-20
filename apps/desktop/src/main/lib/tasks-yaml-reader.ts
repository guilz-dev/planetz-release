import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  formatRunId,
  normalizeTaskStatus,
  type TaskFailure,
  type TaskStatus,
  type TaskViewModel,
  type UiConfig,
} from '@planetz/shared'
import { parse as parseYaml } from 'yaml'
import { coerceIsoTimestamp } from '../planetz/analytics-timestamp.js'
import { resolveTaskOpenPath, resolveWorktreeAbsPath } from './task-work-dir.js'
import { normalizeEnqueueTitle } from './title-generator.js'

interface TasksYamlFailure {
  error?: string
  step?: string
  last_message?: string
}

interface TasksYamlTask {
  name?: string
  run_slug?: string
  worktree_path?: string
  status?: string
  task_dir?: string
  issue?: number | null
  workflow?: string
  branch?: string
  created_at?: string
  started_at?: string | null
  completed_at?: string | null
  failure?: TasksYamlFailure
}

interface TasksYamlRoot {
  tasks?: TasksYamlTask[]
}

export interface TaskRunEventSources {
  runDirSlugToTaskId: ReadonlyMap<string, string>
  additionalRunRoots: readonly string[]
}

function isFailureStatus(status: TaskStatus): status is 'failed' | 'exceeded' {
  return status === 'failed' || status === 'exceeded'
}

function firstNonEmptyString(values: ReadonlyArray<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed.length > 0) return trimmed
  }
  return undefined
}

function deriveFailureFromYaml(
  task: TasksYamlTask,
  status: TaskStatus,
  fallbackAt: string,
): TaskFailure | undefined {
  if (!isFailureStatus(status)) return undefined
  const message = firstNonEmptyString([task.failure?.error, task.failure?.last_message])
  if (!message) return undefined
  const failedAt =
    firstNonEmptyString([task.completed_at, task.started_at, task.created_at]) ?? fallbackAt
  const taskDirName = firstNonEmptyString([task.task_dir])
  const runId = taskDirName ? formatRunId(basename(taskDirName), 'task-state') : undefined
  const failedStep = firstNonEmptyString([task.failure?.step])
  return {
    failedAt,
    message,
    ...(failedStep ? { failedStep } : {}),
    ...(runId ? { runId } : {}),
    kind: status,
  }
}

function titleFromOrderBody(body: string | undefined, fallback: string): string {
  const firstLine = body?.split(/\r?\n/, 1)[0] ?? ''
  const normalized = normalizeEnqueueTitle(firstLine)
  return normalized.length > 0 ? normalized : fallback
}

function normalizeIssueNumber(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : undefined
}

/**
 * Builds a mapping of run directory slug → task ID from tasks.yaml `run_slug` fields.
 * Used by the run events parser to tag JSONL events with the owning task ID when
 * the JSONL itself does not include a `taskId` field (Orbit runtime behaviour).
 */
export async function readTaskRunEventSources(
  workspacePath: string,
  config: UiConfig,
): Promise<TaskRunEventSources> {
  const doc = await readTasksYamlDocument(workspacePath, config)
  if (!doc?.tasks || !Array.isArray(doc.tasks)) {
    return { runDirSlugToTaskId: new Map(), additionalRunRoots: [] }
  }

  const runDirSlugToTaskId = new Map<string, string>()
  const additionalRunRoots = new Set<string>()
  for (const t of doc.tasks) {
    if (
      typeof t.name === 'string' &&
      t.name.length > 0 &&
      typeof t.run_slug === 'string' &&
      t.run_slug.length > 0
    ) {
      runDirSlugToTaskId.set(t.run_slug, t.name)
    }
    if (typeof t.worktree_path === 'string' && t.worktree_path.trim().length > 0) {
      additionalRunRoots.add(
        join(resolveWorktreeAbsPath(workspacePath, t.worktree_path), config.runsDir),
      )
    }
  }

  return { runDirSlugToTaskId, additionalRunRoots: [...additionalRunRoots] }
}

export async function readRunDirSlugToTaskId(
  workspacePath: string,
  config: UiConfig,
): Promise<ReadonlyMap<string, string>> {
  const sources = await readTaskRunEventSources(workspacePath, config)
  return sources.runDirSlugToTaskId
}

/** Single tasks.yaml row by task id (`name` field). */
export async function readTaskYamlRow(
  workspacePath: string,
  config: UiConfig,
  taskId: string,
): Promise<TasksYamlTask | null> {
  const doc = await readTasksYamlDocument(workspacePath, config)
  if (!doc?.tasks || !Array.isArray(doc.tasks)) return null
  const row = doc.tasks.find((t) => t.name === taskId)
  return row ?? null
}

export async function readTasksFromYaml(
  workspacePath: string,
  config: UiConfig,
): Promise<TaskViewModel[]> {
  const doc = await readTasksYamlDocument(workspacePath, config)
  if (!doc) return []
  if (!Array.isArray(doc.tasks)) return []

  const mapped: TaskViewModel[] = []
  for (const t of doc.tasks) {
    if (typeof t.name !== 'string' || t.name.length === 0) continue
    mapped.push(await mapYamlTask(workspacePath, t))
  }
  return mapped
}

async function readTasksYamlDocument(
  workspacePath: string,
  config: UiConfig,
): Promise<TasksYamlRoot | undefined> {
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  let raw: string
  try {
    raw = await readFile(tasksYamlPath, 'utf8')
  } catch {
    return undefined
  }
  try {
    return parseYaml(raw) as TasksYamlRoot
  } catch {
    return undefined
  }
}

async function mapYamlTask(workspacePath: string, t: TasksYamlTask): Promise<TaskViewModel> {
  const normalized = normalizeTaskStatus(t.status)
  const { status, rawStatus, statusReason, errorKind } = normalized
  const taskName = t.name as string
  const createdAt = coerceIsoTimestamp(t.created_at, new Date().toISOString())
  const updatedAtSource =
    status === 'running'
      ? (t.started_at ?? t.created_at)
      : (t.completed_at ?? t.started_at ?? t.created_at)
  const updatedAt = coerceIsoTimestamp(updatedAtSource, createdAt)
  let body: string | undefined
  if (t.task_dir) {
    try {
      body =
        (await readFile(join(workspacePath, t.task_dir, 'order.md'), 'utf8')).trim() || undefined
    } catch {
      body = undefined
    }
  }
  const failure = deriveFailureFromYaml(t, status, updatedAt)
  const workDirPath = resolveTaskOpenPath(workspacePath, t as Record<string, unknown>) ?? undefined
  const issueNumber = normalizeIssueNumber(t.issue)
  return {
    id: taskName,
    title: titleFromOrderBody(body, taskName),
    body,
    ...(issueNumber ? { issueNumber } : {}),
    workflow: t.workflow,
    priority: 'normal',
    status,
    source: 'takt',
    sourceBranch: t.branch ?? undefined,
    ...(workDirPath ? { workDirPath } : {}),
    createdAt,
    updatedAt,
    rawStatus,
    ...(statusReason ? { statusReason } : {}),
    ...(errorKind ? { errorKind } : {}),
    ...(failure ? { failure } : {}),
  }
}
