import { readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { COMPOSER_DEFAULT_WORKFLOW_NAME, type UiConfig } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

function taskDirFromRow(row: Record<string, unknown>): string | null {
  const taskDir = row.task_dir
  if (typeof taskDir !== 'string' || taskDir.length === 0) return null
  return taskDir
}

/** Bundled takt rejects duplicate `name` values; keep the latest row per name. */
function dedupeTaskRowsByName(tasks: Array<Record<string, unknown>>): {
  tasks: Array<Record<string, unknown>>
  changed: boolean
  removedTaskDirs: string[]
} {
  const seen = new Set<string>()
  const kept: Array<Record<string, unknown>> = []
  const removedTaskDirs: string[] = []
  let changed = false
  for (let i = tasks.length - 1; i >= 0; i -= 1) {
    const row = tasks[i]
    const name = row.name
    if (typeof name !== 'string' || name.length === 0) {
      kept.unshift(row)
      continue
    }
    if (seen.has(name)) {
      changed = true
      const droppedDir = taskDirFromRow(row)
      if (droppedDir) removedTaskDirs.push(droppedDir)
      continue
    }
    seen.add(name)
    kept.unshift(row)
  }
  return { tasks: kept, changed, removedTaskDirs }
}

/** Workflow id stored in tasks.yaml (short name, not runtime materialized path). */
export function normalizeWorkflowForTasksYaml(workflow?: string): string {
  const raw = workflow?.trim() || COMPOSER_DEFAULT_WORKFLOW_NAME
  const base = basename(raw).replace(/\.(yaml|yml)$/i, '')
  return base.length > 0 ? base : COMPOSER_DEFAULT_WORKFLOW_NAME
}

const NULLABLE_TASK_FIELDS = ['branch', 'worktree', 'issue'] as const

/** Values takt rejects as an explicit base_branch at execution time. */
function isInvalidExplicitBaseBranch(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return true
  if (trimmed === 'HEAD') return true
  if (trimmed.startsWith('origin/')) return true
  if (trimmed.startsWith('refs/remotes/')) return true
  return false
}

function normalizeTaskRowForTakt(row: Record<string, unknown>): boolean {
  let changed = false
  if ('execution_profile' in row) {
    delete row.execution_profile
    changed = true
  }
  for (const key of NULLABLE_TASK_FIELDS) {
    if (key in row && row[key] === null) {
      delete row[key]
      changed = true
    }
  }
  if ('base_branch' in row && isInvalidExplicitBaseBranch(row.base_branch)) {
    delete row.base_branch
    changed = true
  }
  const workflow = row.workflow
  if (typeof workflow === 'string' && workflow.includes('/')) {
    row.workflow = normalizeWorkflowForTasksYaml(workflow)
    changed = true
  }
  return changed
}

async function removeDroppedTaskPackageDirs(
  workspacePath: string,
  taskDirs: string[],
): Promise<void> {
  for (const taskDir of taskDirs) {
    await rm(join(workspacePath, taskDir), { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Remove fields unsupported by bundled takt strict schema from tasks rows.
 */
export async function sanitizeTasksYamlForTakt(
  workspacePath: string,
  config: UiConfig,
): Promise<boolean> {
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  return withTasksYamlLock(tasksYamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return false
    }
    if (!Array.isArray(root.tasks)) return false

    let changed = false
    for (const row of root.tasks) {
      if (normalizeTaskRowForTakt(row)) changed = true
    }

    const deduped = dedupeTaskRowsByName(root.tasks)
    if (deduped.changed) {
      root.tasks = deduped.tasks
      changed = true
      await removeDroppedTaskPackageDirs(workspacePath, deduped.removedTaskDirs)
    }

    if (!changed) return false

    await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
    return true
  })
}
