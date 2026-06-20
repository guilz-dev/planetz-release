import { access, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve, sep } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { shell } from 'electron'
import { parse as parseYaml } from 'yaml'
import { isolatedTaktWorktreesRoot } from '../planetz/isolated-workspace-paths.js'
import { withTasksYamlLock } from './tasks-yaml-lock.js'

export type OpenTaskWorkDirResult =
  | { status: 'opened'; path: string }
  | { status: 'not_found'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'failed'; path?: string; message: string }

export type TaskWorkDirPurpose = 'open' | 'clone'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

export function resolveAllowedWorkDirRoots(
  taktRepoPath: string,
  workspacePath: string | null,
): string[] {
  const roots = [resolve(taktRepoPath), resolve(isolatedTaktWorktreesRoot(taktRepoPath))]
  if (workspacePath) {
    const workspaceRoot = resolve(workspacePath)
    if (!roots.includes(workspaceRoot)) {
      roots.push(workspaceRoot)
    }
  }
  return roots
}

/** Absolute path for tasks.yaml `worktree_path` (relative values are under taktRepoPath). */
export function resolveWorktreeAbsPath(taktRepoPath: string, worktreePath: string): string {
  const trimmed = worktreePath.trim()
  if (isAbsolute(trimmed)) return resolve(trimmed)
  return resolve(taktRepoPath, trimmed)
}

function resolveTaskDirAbsPath(taktRepoPath: string, taskDir: string): string {
  const trimmed = taskDir.trim()
  if (isAbsolute(trimmed)) return resolve(trimmed)
  return resolve(taktRepoPath, trimmed)
}

/** UI / open-in-Finder: worktree clone, else task package; never isolated repo root alone. */
export function resolveTaskOpenPath(
  taktRepoPath: string,
  row: Record<string, unknown>,
): string | null {
  const worktree = row.worktree_path
  if (typeof worktree === 'string' && worktree.trim().length > 0) {
    return resolveWorktreeAbsPath(taktRepoPath, worktree)
  }
  const taskDir = row.task_dir
  if (typeof taskDir === 'string' && taskDir.trim().length > 0) {
    return resolveTaskDirAbsPath(taktRepoPath, taskDir)
  }
  return null
}

/** Git clone restore: shared clone path, else in-place isolated repo root. */
export function resolveTaskClonePath(
  taktRepoPath: string,
  row: Record<string, unknown>,
): string | null {
  const worktree = row.worktree_path
  if (typeof worktree === 'string' && worktree.trim().length > 0) {
    return resolveWorktreeAbsPath(taktRepoPath, worktree)
  }
  return resolve(taktRepoPath)
}

/**
 * @deprecated Prefer {@link resolveTaskOpenPath} or {@link resolveTaskClonePath}.
 */
export function resolveTaskWorkDirAbsPath(
  taktRepoPath: string,
  row: Record<string, unknown>,
): string | null {
  return resolveTaskClonePath(taktRepoPath, row)
}

export function isPathUnderAllowedRoot(
  candidate: string,
  allowedRoots: readonly string[],
): boolean {
  const resolved = resolve(candidate)
  for (const root of allowedRoots) {
    const rootResolved = resolve(root)
    if (resolved === rootResolved) return true
    if (resolved.startsWith(`${rootResolved}${sep}`)) return true
  }
  return false
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function resolveTaskPathForPurpose(
  taktRepoPath: string,
  row: Record<string, unknown>,
  purpose: TaskWorkDirPurpose,
): string | null {
  return purpose === 'open'
    ? resolveTaskOpenPath(taktRepoPath, row)
    : resolveTaskClonePath(taktRepoPath, row)
}

export async function resolveTaskWorkDirFromYaml(
  taktRepoPath: string,
  config: UiConfig,
  taskId: string,
  purpose: TaskWorkDirPurpose = 'clone',
): Promise<string | null> {
  const yamlPath = join(taktRepoPath, config.tasksYamlPath)
  return withTasksYamlLock(yamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(yamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return null
    }
    if (!Array.isArray(root.tasks)) return null
    const row = root.tasks.find((t) => t.name === taskId)
    if (!row) return null
    return resolveTaskPathForPurpose(taktRepoPath, row, purpose)
  })
}

export async function openTaskWorkDir(input: {
  taktRepoPath: string
  workspacePath: string | null
  config: UiConfig
  taskId: string
}): Promise<OpenTaskWorkDirResult> {
  const workDir = await resolveTaskWorkDirFromYaml(
    input.taktRepoPath,
    input.config,
    input.taskId,
    'open',
  )
  if (!workDir) {
    return { status: 'not_found', message: 'No work directory found for this task' }
  }

  const allowedRoots = resolveAllowedWorkDirRoots(input.taktRepoPath, input.workspacePath)
  if (!isPathUnderAllowedRoot(workDir, allowedRoots)) {
    return { status: 'denied', message: 'Work directory is outside the workspace' }
  }

  if (!(await pathExists(workDir))) {
    return { status: 'not_found', message: 'Work directory does not exist on disk' }
  }

  const openError = await shell.openPath(workDir)
  if (openError) {
    return { status: 'failed', path: workDir, message: openError }
  }
  return { status: 'opened', path: workDir }
}
