import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  gitBranchExists,
  isGitBranchFormatValid,
  rejectInvalidGitBranchName,
} from '../lib/git-branch-exists.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

const execaMock = vi.mocked(execa)

beforeEach(() => {
  execaMock.mockReset()
})

describe('rejectInvalidGitBranchName', () => {
  it('throws for invalid branch names', () => {
    expect(() => rejectInvalidGitBranchName('bad..branch')).toThrow(/Invalid branch name/)
  })

  it('returns trimmed valid names', () => {
    expect(rejectInvalidGitBranchName('  feature/foo  ')).toBe('feature/foo')
  })
})

describe('isGitBranchFormatValid', () => {
  it('returns false for invalid branch names without calling git', async () => {
    const valid = await isGitBranchFormatValid('/tmp/repo', 'bad..branch')
    expect(valid).toBe(false)
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('uses git check-ref-format when cwd is a repository', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0 } as never)
    await expect(isGitBranchFormatValid('/tmp/repo', 'feature/foo')).resolves.toBe(true)
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['check-ref-format', '--branch', 'feature/foo'],
      expect.objectContaining({ cwd: '/tmp/repo', reject: false }),
    )
  })

  it('rejects names git check-ref-format rejects', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stderr: 'fatal: invalid ref' } as never)
    await expect(isGitBranchFormatValid('/tmp/repo', 'weird ref')).resolves.toBe(false)
  })
})

describe('gitBranchExists', () => {
  it('returns false when check-ref-format fails', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stderr: 'invalid' } as never)
    await expect(gitBranchExists('/tmp/repo', 'feature/foo')).resolves.toBe(false)
  })

  it('returns true when local ref exists', async () => {
    execaMock
      .mockResolvedValueOnce({ exitCode: 0 } as never) // check-ref-format
      .mockResolvedValueOnce({ exitCode: 0 } as never) // show-ref heads
    await expect(gitBranchExists('/tmp/repo', 'feature/foo')).resolves.toBe(true)
    expect(execaMock).toHaveBeenCalledTimes(2)
  })
})
