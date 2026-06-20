import { DEFAULT_CONFIG } from '@planetz/shared'
import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRANCH_NOT_READY_ERROR_CODE,
  prepareTaskBranchForRoot,
} from '../lib/prepare-task-branch-for-root.js'
import { isBranchNotReadyMessage, ResultDiffService } from '../session/result-diff-service.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('../lib/git-branch-exists.js', () => ({
  rejectInvalidGitBranchName: vi.fn((branch: string) => branch.trim()),
  isGitBranchFormatValid: vi.fn(async () => true),
}))

vi.mock('../lib/git-default-branch.js', () => ({
  detectGitDefaultBranch: vi.fn(async () => 'main'),
}))

vi.mock('../lib/prepare-task-branch-for-root.js', () => ({
  BRANCH_NOT_READY_ERROR_CODE: 'BRANCH_NOT_READY',
  prepareTaskBranchForRoot: vi.fn(async () => ({ restored: false })),
}))

const execaMock = vi.mocked(execa)
const prepareTaskBranchForRootMock = vi.mocked(prepareTaskBranchForRoot)

describe('ResultDiffService', () => {
  let service: ResultDiffService
  const context = { taktRepoPath: '/tmp/repo', config: DEFAULT_CONFIG }

  beforeEach(() => {
    service = new ResultDiffService()
    execaMock.mockReset()
    prepareTaskBranchForRootMock.mockReset()
    prepareTaskBranchForRootMock.mockResolvedValue({ restored: false })
  })

  it('builds diff summary with rename and binary metadata', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'R100\told/path.md\tnew/path.md\nA\tassets/img.png\n',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '0\t0\tnew/path.md\n',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '-\t-\tassets/img.png\n',
        stderr: '',
      } as never)

    const summary = await service.listTaskResultDiff(context, {
      taskId: 'task-1',
      branch: ' feature/x ',
    })

    expect(summary.baseRef).toBe('main')
    expect(summary.branch).toBe('feature/x')
    expect(summary.files).toEqual([
      {
        oldPath: 'old/path.md',
        path: 'new/path.md',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      },
      {
        path: 'assets/img.png',
        status: 'binary',
        additions: 0,
        deletions: 0,
        binary: true,
      },
    ])
  })

  it('returns rename-only meta line when unified diff is empty', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'R100\told/name.ts\tnew/name.ts\n',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as never)

    const file = await service.getTaskResultDiffFile(context, {
      taskId: 'task-1',
      branch: 'feature/x',
      path: 'new/name.ts',
    })

    expect(file.status).toBe('renamed')
    expect(file.lines).toEqual([{ kind: 'meta', text: 'File renamed without content changes.' }])
  })

  it('reuses cached summary rows during file fetch', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'M\tREADME.md\n',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '2\t1\tREADME.md\n',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '@@ -1 +1 @@\n-old\n+new\n',
        stderr: '',
      } as never)

    await service.listTaskResultDiff(context, { taskId: 'task-1', branch: 'feature/cache' })
    await service.getTaskResultDiffFile(context, {
      taskId: 'task-1',
      branch: 'feature/cache',
      path: 'README.md',
    })
    await service.getTaskResultDiffFile(context, {
      taskId: 'task-1',
      branch: 'feature/cache',
      path: 'README.md',
    })

    expect(execaMock).toHaveBeenCalledTimes(3)
  })

  it('rejects absolute paths', async () => {
    await expect(
      service.getTaskResultDiffFile(context, {
        taskId: 'task-1',
        branch: 'feature/x',
        path: '/etc/passwd',
      }),
    ).rejects.toThrow('Invalid diff path')
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('classifies branch-not-ready errors by message prefix', () => {
    const message = `${BRANCH_NOT_READY_ERROR_CODE}: missing`
    expect(isBranchNotReadyMessage(message)).toBe(true)
    expect(isBranchNotReadyMessage('other error')).toBe(false)
  })
})
