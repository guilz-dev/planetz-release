import { isValidGitBranchName } from '@planetz/shared'
import { execa } from 'execa'

/** Fast local check before invoking git. */
export function rejectInvalidGitBranchName(branch: string): string {
  const trimmed = branch.trim()
  if (!isValidGitBranchName(trimmed)) {
    throw new Error('Invalid branch name')
  }
  return trimmed
}

/** `git check-ref-format --branch` when cwd is a git repo; falls back to shared rules only. */
export async function isGitBranchFormatValid(cwd: string, branch: string): Promise<boolean> {
  const trimmed = branch.trim()
  if (!isValidGitBranchName(trimmed)) return false

  const result = await execa('git', ['check-ref-format', '--branch', trimmed], {
    cwd,
    reject: false,
  })
  if (result.exitCode === 0) return true

  // Outside a git work tree (e.g. tests): rely on shared rules only.
  if (/not a git repository/i.test(result.stderr ?? '')) {
    return true
  }
  return false
}

/** Returns true when `branch` exists as a local or origin remote ref. */
export async function gitBranchExists(cwd: string, branch: string): Promise<boolean> {
  if (!(await isGitBranchFormatValid(cwd, branch))) return false
  const trimmed = branch.trim()

  const local = await execa('git', ['show-ref', '--verify', `refs/heads/${trimmed}`], {
    cwd,
    reject: false,
  })
  if (local.exitCode === 0) return true

  const remote = await execa('git', ['show-ref', '--verify', `refs/remotes/origin/${trimmed}`], {
    cwd,
    reject: false,
  })
  return remote.exitCode === 0
}
