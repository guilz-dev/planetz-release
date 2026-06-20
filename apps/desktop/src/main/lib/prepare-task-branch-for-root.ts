import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE, type UiConfig } from '@planetz/shared'
import { execa } from 'execa'
import { resolveTaskWorkDirFromYaml } from './task-work-dir.js'

export const BRANCH_NOT_READY_ERROR_CODE = TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE

function branchNotReady(message: string): Error {
  return new Error(`${BRANCH_NOT_READY_ERROR_CODE}: ${message}`)
}

async function localBranchExists(cwd: string, branch: string): Promise<boolean> {
  const result = await execa('git', ['show-ref', '--verify', `refs/heads/${branch}`], {
    cwd,
    reject: false,
  })
  return result.exitCode === 0
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function prepareTaskBranchForRoot(input: {
  taktRepoPath: string
  config: UiConfig
  taskId: string
  branch: string
}): Promise<{ restored: boolean }> {
  const rootPath = resolve(input.taktRepoPath)
  if (await localBranchExists(rootPath, input.branch)) {
    return { restored: false }
  }

  const workDir = await resolveTaskWorkDirFromYaml(input.taktRepoPath, input.config, input.taskId)
  if (!workDir) {
    throw branchNotReady(`No worktree metadata found for task ${input.taskId}`)
  }
  const clonePath = resolve(workDir)
  if (clonePath === rootPath) {
    throw branchNotReady(
      `Branch ${input.branch} is missing in root and no task worktree is available`,
    )
  }
  if (!(await pathExists(clonePath))) {
    throw branchNotReady(`Task worktree does not exist on disk: ${clonePath}`)
  }

  const fetchResult = await execa('git', ['fetch', clonePath, `HEAD:refs/heads/${input.branch}`], {
    cwd: rootPath,
    reject: false,
  })
  if (fetchResult.exitCode !== 0) {
    const detail = fetchResult.stderr.trim() || fetchResult.stdout.trim() || 'git fetch failed'
    throw branchNotReady(`Failed to restore branch ${input.branch} from worktree: ${detail}`)
  }

  if (!(await localBranchExists(rootPath, input.branch))) {
    throw branchNotReady(`Branch ${input.branch} could not be restored to root repository`)
  }
  return { restored: true }
}
