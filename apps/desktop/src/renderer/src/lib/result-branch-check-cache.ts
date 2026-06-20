import type { ResultCheckBranchResult } from '@planetz/shared'

const branchCheckCache = new Map<string, Promise<ResultCheckBranchResult>>()

export function invalidateResultBranchCheck(branch: string): void {
  branchCheckCache.delete(branch.trim())
}

export function checkResultBranchCached(input: {
  taskId: string
  branch: string
}): Promise<ResultCheckBranchResult> {
  const key = input.branch.trim()
  const cached = branchCheckCache.get(key)
  if (cached) return cached
  const pending = window.orbit.checkResultBranch(input)
  branchCheckCache.set(key, pending)
  return pending
}

export function refreshResultBranchCheck(input: {
  taskId: string
  branch: string
}): Promise<ResultCheckBranchResult> {
  invalidateResultBranchCheck(input.branch)
  return checkResultBranchCached(input)
}
