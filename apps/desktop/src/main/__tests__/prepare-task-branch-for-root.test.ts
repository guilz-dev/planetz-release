import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRANCH_NOT_READY_ERROR_CODE,
  prepareTaskBranchForRoot,
} from '../lib/prepare-task-branch-for-root.js'
import { resolveTaskWorkDirFromYaml } from '../lib/task-work-dir.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('../lib/task-work-dir.js', () => ({
  resolveTaskWorkDirFromYaml: vi.fn(),
}))

const execaMock = vi.mocked(execa)
const resolveTaskWorkDirFromYamlMock = vi.mocked(resolveTaskWorkDirFromYaml)

describe('prepareTaskBranchForRoot', () => {
  const tempDirs: string[] = []

  beforeEach(() => {
    execaMock.mockReset()
    resolveTaskWorkDirFromYamlMock.mockReset()
  })

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('returns restored=false when local branch already exists', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0 } as never)

    await expect(
      prepareTaskBranchForRoot({
        taktRepoPath: '/tmp/repo',
        config: DEFAULT_CONFIG,
        taskId: 'task-1',
        branch: 'feature/x',
      }),
    ).resolves.toEqual({ restored: false })
  })

  it('restores branch from task worktree when local branch is missing', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'planetz-prepare-'))
    const worktree = join(repo, '.planetz', 'takt-worktrees', 'task-1')
    mkdirSync(worktree, { recursive: true })
    tempDirs.push(repo)
    execaMock
      .mockResolvedValueOnce({ exitCode: 1 } as never)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as never)
      .mockResolvedValueOnce({ exitCode: 0 } as never)
    resolveTaskWorkDirFromYamlMock.mockResolvedValue(worktree)

    await expect(
      prepareTaskBranchForRoot({
        taktRepoPath: repo,
        config: DEFAULT_CONFIG,
        taskId: 'task-1',
        branch: 'feature/x',
      }),
    ).resolves.toEqual({ restored: true })
  })

  it('throws BRANCH_NOT_READY when no worktree metadata exists', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1 } as never)
    resolveTaskWorkDirFromYamlMock.mockResolvedValue(null)

    await expect(
      prepareTaskBranchForRoot({
        taktRepoPath: '/tmp/repo',
        config: DEFAULT_CONFIG,
        taskId: 'task-1',
        branch: 'feature/x',
      }),
    ).rejects.toThrow(`${BRANCH_NOT_READY_ERROR_CODE}:`)
  })
})
