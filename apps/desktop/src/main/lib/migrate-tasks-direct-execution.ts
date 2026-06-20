import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeTaskStatus, type UiConfig } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

const STRIPPED_KEYS = ['worktree', 'auto_pr', 'draft_pr', 'managed_pr'] as const

export interface TasksDirectExecutionMigrationResult {
  changed: boolean
  migratedCount: number
}

/** @deprecated Use {@link TasksDirectExecutionMigrationResult}. */
export type PendingTaskDirectMigrationResult = TasksDirectExecutionMigrationResult

function hasWorktreeIntent(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'string' && value.trim().length > 0) return true
  return false
}

function stripDirectExecutionIncompatibleFields(row: Record<string, unknown>): boolean {
  let changed = false
  for (const key of STRIPPED_KEYS) {
    if (key in row) {
      delete row[key]
      changed = true
    }
  }
  return changed
}

const DIRECT_EXECUTION_MIGRATION_STATUSES = new Set(['pending', 'failed'])

/**
 * Normalize task rows that still request worktree clone execution on the isolated repo.
 * Idempotent; affects pending and failed tasks (not running/completed).
 */
export async function migrateTasksToDirectExecutionIfNeeded(
  taktRepoPath: string,
  config: UiConfig,
): Promise<TasksDirectExecutionMigrationResult> {
  const tasksYamlPath = join(taktRepoPath, config.tasksYamlPath)
  return withTasksYamlLock(tasksYamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return { changed: false, migratedCount: 0 }
    }
    if (!Array.isArray(root.tasks)) return { changed: false, migratedCount: 0 }

    let changed = false
    let migratedCount = 0
    for (const row of root.tasks) {
      const normalized = normalizeTaskStatus(
        typeof row.status === 'string' ? row.status : undefined,
      )
      if (!DIRECT_EXECUTION_MIGRATION_STATUSES.has(normalized.status)) continue
      if (!hasWorktreeIntent(row.worktree)) continue
      if (stripDirectExecutionIncompatibleFields(row)) {
        changed = true
        migratedCount += 1
      }
    }

    if (!changed) return { changed: false, migratedCount: 0 }
    await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
    return { changed: true, migratedCount }
  })
}

/** @deprecated Use {@link migrateTasksToDirectExecutionIfNeeded}. */
export const migratePendingTasksToDirectExecutionIfNeeded = migrateTasksToDirectExecutionIfNeeded
