import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkResultBranchCached,
  invalidateResultBranchCheck,
  refreshResultBranchCheck,
} from '../result-branch-check-cache.js'

describe('result-branch-check-cache', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      orbit: {
        checkResultBranch: vi.fn(async () => ({ exists: true, defaultBaseBranch: 'main' })),
      },
    })
    invalidateResultBranchCheck('feature/a')
    invalidateResultBranchCheck('feature/b')
  })

  it('reuses cached branch checks until invalidated', async () => {
    const input = { taskId: 'task-1', branch: 'feature/a' }
    await checkResultBranchCached(input)
    await checkResultBranchCached(input)
    expect(window.orbit.checkResultBranch).toHaveBeenCalledTimes(1)
  })

  it('refresh bypasses stale cache entries', async () => {
    const input = { taskId: 'task-1', branch: 'feature/b' }
    await checkResultBranchCached(input)
    vi.mocked(window.orbit.checkResultBranch).mockResolvedValueOnce({ exists: false })
    const refreshed = await refreshResultBranchCheck(input)
    expect(refreshed.exists).toBe(false)
    expect(window.orbit.checkResultBranch).toHaveBeenCalledTimes(2)
  })
})
