import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseGitHubRemoteUrl } from '../lib/github-remote-url.js'
import { GitHubIssueService, resolveGitHubIssueRef } from '../session/github-issue-service.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

const execaMock = vi.mocked(execa)

describe('GitHubIssueService ref parsing', () => {
  beforeEach(() => {
    execaMock.mockReset()
  })

  it('parses GitHub remote URLs', () => {
    expect(parseGitHubRemoteUrl('https://github.com/guilz-dev/planetz.git')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
    })
    expect(parseGitHubRemoteUrl('git@github.com:guilz-dev/planetz.git')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
    })
  })

  it('resolves URL and shorthand refs', async () => {
    await expect(
      resolveGitHubIssueRef('https://github.com/guilz-dev/planetz/issues/368', null),
    ).resolves.toEqual({ owner: 'guilz-dev', name: 'planetz', number: 368 })

    await expect(resolveGitHubIssueRef('guilz-dev/planetz#42', null)).resolves.toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
      number: 42,
    })
  })

  it('resolves #123 from workspace origin', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'https://github.com/guilz-dev/planetz.git',
      stderr: '',
    } as never)

    await expect(resolveGitHubIssueRef('#123', '/tmp/ws')).resolves.toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
      number: 123,
    })
  })

  it('throws repo_required when #123 cannot resolve origin repo', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' } as never)

    await expect(resolveGitHubIssueRef('#123', '/tmp/ws')).rejects.toThrow(
      '[github-issue:repo_required]',
    )
  })

  it('throws invalid_issue_ref for unknown formats', async () => {
    await expect(resolveGitHubIssueRef('not-an-issue', null)).rejects.toThrow(
      '[github-issue:invalid_issue_ref]',
    )
  })
})

describe('GitHubIssueService.fetch', () => {
  const service = new GitHubIssueService()

  beforeEach(() => {
    execaMock.mockReset()
  })

  it('maps gh JSON into GitHubIssueView', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 368,
        title: 'Sample',
        body: 'Body',
        url: 'https://github.com/guilz-dev/planetz/issues/368',
        state: 'OPEN',
        labels: [{ name: 'bug' }],
        author: { login: 'kaz' },
      }),
      stderr: '',
    } as never)

    const issue = await service.fetch(
      { ref: 'guilz-dev/planetz#368' },
      { workspacePath: '/tmp/ws' },
    )

    expect(issue).toMatchObject({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Sample',
      state: 'open',
      labels: ['bug'],
      author: 'kaz',
    })
    expect(execaMock).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['issue', 'view', '368', '--repo', 'guilz-dev/planetz']),
      expect.any(Object),
    )
  })

  it('maps gh auth failures to gh_auth_required', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'authentication required: run gh auth login',
    } as never)

    await expect(
      service.fetch({ ref: 'guilz-dev/planetz#1' }, { workspacePath: null }),
    ).rejects.toThrow('[github-issue:gh_auth_required]')
  })

  it('does not map unknown flag help with assignee login to gh_auth_required', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: `unknown flag: --json

Flags:
  -a, --assignee login       Assign people by their login.`,
    } as never)

    await expect(
      service.fetch({ ref: 'guilz-dev/planetz#1' }, { workspacePath: null }),
    ).rejects.not.toThrow('[github-issue:gh_auth_required]')
  })

  it('maps missing gh binary to gh_not_found', async () => {
    execaMock.mockRejectedValueOnce(Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' }))

    await expect(
      service.fetch({ ref: 'guilz-dev/planetz#1' }, { workspacePath: null }),
    ).rejects.toThrow('[github-issue:gh_not_found]')
  })

  it('maps gh issue not found to issue_not_found', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'Could not resolve to an issue',
    } as never)

    await expect(
      service.fetch({ ref: 'guilz-dev/planetz#99999' }, { workspacePath: null }),
    ).rejects.toThrow('[github-issue:issue_not_found]')
  })

  it('maps gh permission errors to permission_denied', async () => {
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'HTTP 403: Forbidden — permission denied',
    } as never)

    await expect(
      service.fetch({ ref: 'guilz-dev/planetz#1' }, { workspacePath: null }),
    ).rejects.toThrow('[github-issue:permission_denied]')
  })
})

describe('GitHubIssueService.listOpen', () => {
  const service = new GitHubIssueService()

  beforeEach(() => {
    execaMock.mockReset()
  })

  it('lists open issues with created-desc pagination', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'https://github.com/guilz-dev/planetz.git',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 380,
                    title: 'Latest issue',
                    url: 'https://github.com/guilz-dev/planetz/issues/380',
                    createdAt: '2026-05-31T10:00:00Z',
                    state: 'OPEN',
                    labels: { nodes: [{ name: 'bug' }] },
                    author: { login: 'kaz' },
                  },
                ],
                pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
              },
            },
          },
        }),
        stderr: '',
      } as never)

    const result = await service.listOpen({ after: 'cursor-0' }, { workspacePath: '/tmp/ws' })

    expect(result).toMatchObject({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [{ number: 380, state: 'open', labels: ['bug'], author: 'kaz' }],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
    })
    expect(execaMock).toHaveBeenNthCalledWith(
      2,
      'gh',
      expect.arrayContaining(['api', 'graphql', '-F', 'after=cursor-0']),
      expect.any(Object),
    )
  })

  it('throws repo_required when workspace is missing', async () => {
    await expect(service.listOpen({}, { workspacePath: null })).rejects.toThrow(
      '[github-issue:repo_required]',
    )
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('throws repo_required when origin repository cannot be resolved', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' } as never)

    await expect(service.listOpen({}, { workspacePath: '/tmp/ws' })).rejects.toThrow(
      '[github-issue:repo_required]',
    )
  })

  it('maps list auth failures to gh_auth_required', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'https://github.com/guilz-dev/planetz.git',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'authentication required: run gh auth login',
      } as never)

    await expect(service.listOpen({}, { workspacePath: '/tmp/ws' })).rejects.toThrow(
      '[github-issue:gh_auth_required]',
    )
  })
})
