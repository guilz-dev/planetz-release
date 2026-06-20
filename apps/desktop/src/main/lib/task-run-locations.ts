import { access, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResolveTaskResultInput } from './task-result-input.js'
import {
  isPathUnderAllowedRoot,
  resolveAllowedWorkDirRoots,
  resolveWorktreeAbsPath,
} from './task-work-dir.js'
import { readTaskRunEventSources, readTaskYamlRow } from './tasks-yaml-reader.js'

export interface TaskRunLocation {
  runDirSlug: string
  runRoot: string
  reportsDir: string
}

export type TaskReportFileResolution =
  | { status: 'found'; runDirSlug: string; reportsDir: string }
  | { status: 'no_run' }
  | { status: 'path_denied' }
  | { status: 'missing_report'; runDirSlug?: string }

async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

async function resolveRunAtSlug(
  runsRoot: string,
  runDirSlug: string,
): Promise<TaskRunLocation | null> {
  const runRoot = join(runsRoot, runDirSlug)
  if (!(await pathIsDirectory(runRoot))) return null
  return {
    runDirSlug,
    runRoot,
    reportsDir: join(runRoot, 'reports'),
  }
}

async function buildRunRootCandidates(
  input: ResolveTaskResultInput,
  row: { run_slug?: string; worktree_path?: string },
): Promise<string[]> {
  const { taktRepoPath, config } = input
  const runSlug = typeof row.run_slug === 'string' ? row.run_slug.trim() : ''
  const worktree =
    typeof row.worktree_path === 'string' && row.worktree_path.trim().length > 0
      ? row.worktree_path.trim()
      : undefined

  const candidates: string[] = []
  if (runSlug) {
    if (worktree) {
      candidates.push(join(resolveWorktreeAbsPath(taktRepoPath, worktree), config.runsDir))
    }
    candidates.push(join(taktRepoPath, config.runsDir))
  }

  const sources = await readTaskRunEventSources(taktRepoPath, config)
  for (const root of sources.additionalRunRoots) {
    if (!candidates.includes(root)) candidates.push(root)
  }
  const mainRunsRoot = join(taktRepoPath, config.runsDir)
  if (!candidates.includes(mainRunsRoot)) {
    candidates.push(mainRunsRoot)
  }
  return candidates
}

async function listRunLocationsForSlug(
  candidates: string[],
  runSlug: string,
): Promise<TaskRunLocation[]> {
  const locations: TaskRunLocation[] = []
  for (const runsRoot of candidates) {
    const resolved = await resolveRunAtSlug(runsRoot, runSlug)
    if (resolved) locations.push(resolved)
  }
  return locations
}

async function resolveRunLocationForTask(
  input: ResolveTaskResultInput,
  row: { run_slug?: string; worktree_path?: string },
): Promise<TaskRunLocation | null> {
  const { taskId } = input
  const candidates = await buildRunRootCandidates(input, row)
  const sources = await readTaskRunEventSources(input.taktRepoPath, input.config)
  const slugToTask = sources.runDirSlugToTaskId
  let best: { resolved: TaskRunLocation; mtimeMs: number } | null = null
  for (const runsRoot of candidates) {
    let slugs: string[]
    try {
      slugs = await readdir(runsRoot, { withFileTypes: true }).then((ents) =>
        ents.filter((e) => e.isDirectory()).map((e) => e.name),
      )
    } catch {
      continue
    }
    for (const slug of slugs) {
      if (slugToTask.get(slug) !== taskId) continue
      const resolved = await resolveRunAtSlug(runsRoot, slug)
      if (!resolved) continue
      let mtimeMs = 0
      try {
        mtimeMs = (await stat(resolved.runRoot)).mtimeMs
      } catch {
        mtimeMs = 0
      }
      if (!best || mtimeMs >= best.mtimeMs) {
        best = { resolved, mtimeMs }
      }
    }
  }
  return best?.resolved ?? null
}

export async function listRunLocationsForTask(
  input: ResolveTaskResultInput,
  row: { run_slug?: string; worktree_path?: string },
): Promise<TaskRunLocation[]> {
  const runSlug = typeof row.run_slug === 'string' ? row.run_slug.trim() : ''
  const candidates = await buildRunRootCandidates(input, row)
  if (runSlug) {
    return listRunLocationsForSlug(candidates, runSlug)
  }
  const single = await resolveRunLocationForTask(input, row)
  return single ? [single] : []
}

async function reportFileExists(reportsDir: string, fileName: string): Promise<boolean> {
  try {
    await access(join(reportsDir, fileName))
    return true
  } catch {
    return false
  }
}

/**
 * Locate a report file across all run roots (worktree before main).
 * Scans allowed locations in candidate order instead of markdown canonical scoring.
 */
export async function resolveTaskReportFileLocation(
  input: ResolveTaskResultInput,
  reportFileName: string,
): Promise<TaskReportFileResolution> {
  const { taktRepoPath, workspacePath, config, taskId } = input
  try {
    const row = await readTaskYamlRow(taktRepoPath, config, taskId)
    if (!row) return { status: 'no_run' }

    const runLocations = await listRunLocationsForTask(input, row)
    if (runLocations.length === 0) return { status: 'no_run' }

    const allowedRoots = resolveAllowedWorkDirRoots(taktRepoPath, workspacePath)
    const allowedLocations = runLocations.filter((location) =>
      isPathUnderAllowedRoot(location.reportsDir, allowedRoots),
    )
    if (allowedLocations.length === 0) return { status: 'path_denied' }

    for (const location of allowedLocations) {
      if (await reportFileExists(location.reportsDir, reportFileName)) {
        return {
          status: 'found',
          runDirSlug: location.runDirSlug,
          reportsDir: location.reportsDir,
        }
      }
    }

    return {
      status: 'missing_report',
      ...(allowedLocations[0] ? { runDirSlug: allowedLocations[0].runDirSlug } : {}),
    }
  } catch {
    return { status: 'no_run' }
  }
}
