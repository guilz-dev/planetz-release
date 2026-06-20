import { access } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import type { TaskOpenWorkDirResult, TaskResultPathOpenInput } from '@planetz/shared'
import { shell } from 'electron'
import { type ResolveTaskResultInput, resolveTaskResultBundle } from './task-result-service.js'
import { isPathUnderAllowedRoot, resolveAllowedWorkDirRoots } from './task-work-dir.js'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Map bundle-relative report path to an absolute file under reportsDir. */
export function resolveReportAbsPath(reportsDir: string, relativePath: string): string | null {
  const trimmed = relativePath.trim().replace(/\\/g, '/')
  if (!trimmed || trimmed.includes('..')) return null
  const withoutPrefix = trimmed.startsWith('reports/') ? trimmed.slice('reports/'.length) : trimmed
  if (!withoutPrefix || withoutPrefix.includes('..')) return null
  return normalize(join(reportsDir, withoutPrefix))
}

export async function openTaskResultPath(
  input: ResolveTaskResultInput & TaskResultPathOpenInput,
): Promise<TaskOpenWorkDirResult> {
  const { action, relativePath, ...resolveInput } = input
  const bundle = await resolveTaskResultBundle(resolveInput)

  if (bundle.status !== 'ok' || !bundle.reportsPath) {
    return { status: 'not_found', message: 'Reports directory not found for this task' }
  }

  const allowedRoots = resolveAllowedWorkDirRoots(input.taktRepoPath, input.workspacePath)
  if (!isPathUnderAllowedRoot(bundle.reportsPath, allowedRoots)) {
    return { status: 'denied', message: 'Reports path is outside the workspace' }
  }

  if (action === 'reveal_reports_dir') {
    if (!(await pathExists(bundle.reportsPath))) {
      return { status: 'not_found', message: 'Reports directory does not exist on disk' }
    }
    const openError = await shell.openPath(bundle.reportsPath)
    if (openError) {
      return { status: 'failed', path: bundle.reportsPath, message: openError }
    }
    return { status: 'opened', path: bundle.reportsPath }
  }

  if (action === 'open_report') {
    if (!relativePath?.trim()) {
      return { status: 'denied', message: 'relativePath is required for open_report' }
    }
    const absPath = resolveReportAbsPath(bundle.reportsPath, relativePath)
    if (!absPath || !isPathUnderAllowedRoot(absPath, allowedRoots)) {
      return { status: 'denied', message: 'Report path is outside the allowed workspace' }
    }
    if (!(await pathExists(absPath))) {
      return { status: 'not_found', message: 'Report file does not exist on disk' }
    }
    const openError = await shell.openPath(absPath)
    if (openError) {
      return { status: 'failed', path: absPath, message: openError }
    }
    return { status: 'opened', path: absPath }
  }

  return { status: 'denied', message: 'Unknown action' }
}
