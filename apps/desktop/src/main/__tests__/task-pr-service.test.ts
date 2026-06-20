import type { TaskResultBundle, TaskViewModel } from '@planetz/shared'
import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskPrService } from '../session/task-pr-service.js'
import type { TaskPrLinkStore } from '../sidecar/task-pr-link-store.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('../lib/git-branch-exists.js', () => ({
  rejectInvalidGitBranchName: vi.fn((branch: string) => branch.trim()),
  gitBranchExists: vi.fn(async () => true),
}))

vi.mock('../lib/github-remote-url.js', () => ({
  readGitHubRepoFromWorkspaceOrigin: vi.fn(async () => ({ owner: 'guilz-dev', name: 'planetz' })),
}))

const execaMock = vi.mocked(execa)

function createContext(
  overrides: Partial<{
    mockQueueEnabled: boolean
    tasks: TaskViewModel[]
    readTaskResultBundle: (taskId: string) => Promise<TaskResultBundle | null>
    readTaktProjectConfigYaml: () => Promise<string | null>
  }> = {},
) {
  return {
    mockQueueEnabled: () => overrides.mockQueueEnabled ?? false,
    requireTaktRepoPath: () => '/tmp/takt-repo',
    requireSidecarPaths: () =>
      ({
        root: '/tmp/.planetz/orbit',
        isWorkspaceLocal: true,
      }) as never,
    readTaktTasksFresh: async () =>
      (overrides.tasks ?? [
        {
          id: 'task-1',
          title: 'Fix login',
          body: 'Fix login behavior.',
          status: 'completed',
          sourceBranch: 'feature/login',
          priority: 'normal',
          source: 'user',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      ]) as never,
    readTaskResultBundle: overrides.readTaskResultBundle,
    readTaktProjectConfigYaml: overrides.readTaktProjectConfigYaml,
  }
}

function assertNoJsonFlags() {
  for (const call of execaMock.mock.calls) {
    const args = Array.isArray(call[1]) ? call[1] : []
    expect(args.join(' ')).not.toContain('--json')
  }
}

function assertExistingPrLookupUsesQueryEndpoint() {
  const ghApiListCall = execaMock.mock.calls.find((call) => {
    const args = Array.isArray(call[1]) ? call[1] : []
    return (
      args[0] === 'api' &&
      typeof args[1] === 'string' &&
      args[1].startsWith('repos/guilz-dev/planetz/pulls?')
    )
  })
  expect(ghApiListCall).toBeTruthy()
  const endpoint = Array.isArray(ghApiListCall?.[1]) ? ghApiListCall[1][1] : ''
  expect(endpoint).toContain('head=guilz-dev%3Afeature%2Flogin')
  expect(endpoint).not.toContain('-f')
}

function readPrCreateBodyFromCalls(): string {
  const prCreateCall = execaMock.mock.calls.find((call) => {
    const args = Array.isArray(call[1]) ? call[1] : []
    return args[0] === 'pr' && args[1] === 'create'
  })
  expect(prCreateCall).toBeTruthy()
  const args = (Array.isArray(prCreateCall?.[1]) ? prCreateCall?.[1] : []) as string[]
  const bodyIndex = args.indexOf('--body')
  expect(bodyIndex).toBeGreaterThanOrEqual(0)
  const body = args[bodyIndex + 1]
  expect(typeof body).toBe('string')
  return body as string
}

function buildCompletedTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Fix login',
    body: 'Fix login behavior.',
    status: 'completed',
    sourceBranch: 'feature/login',
    priority: 'normal',
    source: 'user',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

describe('TaskPrService', () => {
  const upsert = vi.fn(async () => true)
  const store = { list: vi.fn(), upsert } as unknown as TaskPrLinkStore
  const service = new TaskPrService(store)

  beforeEach(() => {
    execaMock.mockReset()
    upsert.mockClear()
  })

  it('returns exists false in mock queue mode', async () => {
    await expect(
      service.checkBranch(createContext({ mockQueueEnabled: true }), 'feature/login'),
    ).resolves.toEqual({ exists: false })
  })

  it('creates a pull request and stores the link', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        expect(joined).not.toContain('--json')
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    const result = await service.create(createContext(), {
      taskId: 'task-1',
      branch: 'feature/login',
      title: 'Fix login',
    })

    expect(result.status).toBe('created')
    expect(result.pr.number).toBe(99)
    expect(upsert).toHaveBeenCalledOnce()
    assertNoJsonFlags()
    assertExistingPrLookupUsesQueryEndpoint()
  })

  it('auto-generates fallback body when body is empty string', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/issues/24')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 24,
            title: 'Fix login issue',
            body: 'Issue details',
          }),
          stderr: '',
        } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    const resultBundle: TaskResultBundle = {
      taskId: 'task-1',
      status: 'ok',
      runsDirRel: '.takt/runs',
      reports: [
        {
          fileName: 'summary.md',
          relativePath: 'reports/summary.md',
          content: 'Execution report body',
        },
      ],
      primaryIndex: 0,
    }

    await service.create(
      createContext({
        tasks: [buildCompletedTask({ issueNumber: 24 })],
        readTaskResultBundle: async () => resultBundle,
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
        body: '',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('## Summary')
    expect(body).toContain('Issue details')
    expect(body).toContain('## Execution Report')
    expect(body).toContain('Execution report body')
    expect(body).toContain('Closes #24')
  })

  it('treats whitespace-only body as auto-generation target', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(createContext(), {
      taskId: 'task-1',
      branch: 'feature/login',
      body: '   ',
    })

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('## Summary')
    expect(body).toContain('Fix login behavior.')
    expect(body).toContain('Task completed successfully.')
  })

  it('truncates oversized report content in auto-generated body', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(
      createContext({
        readTaskResultBundle: async () => ({
          taskId: 'task-1',
          status: 'ok',
          runsDirRel: '.takt/runs',
          reports: [
            {
              fileName: 'summary.md',
              relativePath: 'reports/summary.md',
              content: 'x'.repeat(25_000),
            },
          ],
          primaryIndex: 0,
        }),
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('(truncated)')
    expect(body.length).toBeLessThan(61_000)
  })

  it('prioritizes pipeline pr_body_template and resolves issue from issueRef repo', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('api repos/octo/demo/issues/321')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 321,
            title: 'Remote issue title',
            body: 'Remote issue body',
          }),
          stderr: '',
        } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    const resultBundle: TaskResultBundle = {
      taskId: 'task-1',
      status: 'ok',
      runsDirRel: '.takt/runs',
      reports: [
        {
          fileName: 'summary.md',
          relativePath: 'reports/summary.md',
          content: 'Template report payload',
        },
      ],
      primaryIndex: 0,
    }

    await service.create(
      createContext({
        tasks: [buildCompletedTask({ issueRef: 'octo/demo#321' })],
        readTaskResultBundle: async () => resultBundle,
        readTaktProjectConfigYaml: async () => `pipeline:
  pr_body_template: |
    Title:{title}
    Issue:{issue}
    IssueBody:{issue_body}
    Report:{report}`,
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('Title:Remote issue title')
    expect(body).toContain('Issue:321')
    expect(body).toContain('IssueBody:Remote issue body')
    expect(body).toContain('Report:Template report payload')
    const issueCall = execaMock.mock.calls.find((call) => {
      const args = Array.isArray(call[1]) ? call[1] : []
      return args[0] === 'api' && args[1] === 'repos/octo/demo/issues/321'
    })
    expect(issueCall).toBeTruthy()
  })

  it('keeps issue number in template when issue fetch fails, and leaves title empty', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('api repos/octo/demo/issues/321')) {
        return { exitCode: 1, stdout: '', stderr: 'not found' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(
      createContext({
        tasks: [buildCompletedTask({ issueRef: 'octo/demo#321' })],
        readTaktProjectConfigYaml: async () => `pipeline:
  pr_body_template: |
    Title:{title}
    Issue:{issue}`,
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('Title:')
    expect(body).toContain('Issue:321')
    expect(body).not.toContain('Title:Fix login')
  })

  it('uses repo-qualified closes reference for cross-repo issue in fallback body', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('api repos/octo/demo/issues/321')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 321,
            title: 'Remote issue title',
            body: 'Remote issue body',
          }),
          stderr: '',
        } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(
      createContext({
        tasks: [buildCompletedTask({ issueRef: 'octo/demo#321' })],
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('Closes octo/demo#321')
    expect(body).not.toContain('Closes #321')
  })

  it('falls back to global takt config template when project config has no template', async () => {
    const { mkdir, rm, writeFile } = await import('node:fs/promises')
    const globalRoot = '/tmp/.planetz/orbit/takt-global'
    await mkdir(globalRoot, { recursive: true })
    await writeFile(
      `${globalRoot}/config.yaml`,
      'pipeline:\n  pr_body_template: "GlobalTemplate:{report}"',
      'utf8',
    )
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    try {
      await service.create(
        createContext({
          readTaktProjectConfigYaml: async () => null,
          readTaskResultBundle: async () => ({
            taskId: 'task-1',
            status: 'ok',
            runsDirRel: '.takt/runs',
            reports: [
              {
                fileName: 'summary.md',
                relativePath: 'reports/summary.md',
                content: 'Global report body',
              },
            ],
            primaryIndex: 0,
          }),
        }),
        {
          taskId: 'task-1',
          branch: 'feature/login',
        },
      )
    } finally {
      await rm('/tmp/.planetz/orbit', { recursive: true, force: true })
    }

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('GlobalTemplate:Global report body')
  })

  it('falls back to default body when template config is invalid', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(
      createContext({
        readTaktProjectConfigYaml: async () => 'pipeline: [',
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toContain('## Summary')
    expect(body).toContain('## Execution Report')
  })

  it('uses manually provided body without auto-generation', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls?')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await service.create(
      createContext({
        tasks: [buildCompletedTask({ issueNumber: 9 })],
      }),
      {
        taskId: 'task-1',
        branch: 'feature/login',
        body: 'Manual body text',
      },
    )

    const body = readPrCreateBodyFromCalls()
    expect(body).toBe('Manual body text')
    const issueCall = execaMock.mock.calls.find((call) => {
      const args = Array.isArray(call[1]) ? call[1] : []
      return args[0] === 'api' && typeof args[1] === 'string' && args[1].includes('/issues/')
    })
    expect(issueCall).toBeUndefined()
  })

  it('rejects when task branch does not match input branch', async () => {
    await expect(
      service.create(createContext(), {
        taskId: 'task-1',
        branch: 'wrong-branch',
      }),
    ).rejects.toThrow('[task-pr:branch_not_found]')
  })

  it('rejects unsupported repositories', async () => {
    const { readGitHubRepoFromWorkspaceOrigin } = await import('../lib/github-remote-url.js')
    vi.mocked(readGitHubRepoFromWorkspaceOrigin).mockResolvedValueOnce(null)

    await expect(
      service.create(createContext(), {
        taskId: 'task-1',
        branch: 'feature/login',
      }),
    ).rejects.toThrow('[task-pr:repo_not_supported]')
  })

  it('rejects when pull request link persistence fails', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/99\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/99')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            number: 99,
            html_url: 'https://github.com/guilz-dev/planetz/pull/99',
            state: 'open',
            draft: false,
            base: { ref: 'main' },
            head: { ref: 'feature/login' },
            merged_at: null,
          }),
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)
    upsert.mockResolvedValueOnce(false)

    await expect(
      service.create(createContext(), {
        taskId: 'task-1',
        branch: 'feature/login',
      }),
    ).rejects.toThrow('[task-pr:unexpected_failure]')
  })

  it('maps unknown flag failures to pr_create_failed (not gh_auth_required)', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: `unknown flag: --json

Flags:
  -a, --assignee login       Assign people by their login.`,
        } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await expect(
      service.create(createContext(), {
        taskId: 'task-1',
        branch: 'feature/login',
      }),
    ).rejects.toThrow('[task-pr:pr_create_failed]')
  })

  it('maps HTTP 401 bad credentials to gh_auth_required', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return { exitCode: 1, stdout: '', stderr: 'HTTP 401: Bad credentials' } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    await expect(
      service.create(createContext(), {
        taskId: 'task-1',
        branch: 'feature/login',
      }),
    ).rejects.toThrow('[task-pr:gh_auth_required]')
  })

  it('falls back to URL metadata when gh pr view fails after create', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 0, stdout: 'refs/remotes/origin/main', stderr: '' } as never
      }
      if (joined.includes('ls-remote')) {
        return { exitCode: 0, stdout: 'deadbeef\trefs/heads/feature/login', stderr: '' } as never
      }
      if (joined.includes('pr create')) {
        return {
          exitCode: 0,
          stdout: 'https://github.com/guilz-dev/planetz/pull/42\n',
          stderr: '',
        } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls/42')) {
        return { exitCode: 1, stdout: '', stderr: 'not found' } as never
      }
      if (joined.includes('api repos/guilz-dev/planetz/pulls')) {
        return { exitCode: 0, stdout: '[]', stderr: '' } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    const result = await service.create(createContext(), {
      taskId: 'task-1',
      branch: 'feature/login',
      draft: true,
    })

    expect(result.status).toBe('created')
    expect(result.pr.number).toBe(42)
    expect(result.pr.url).toBe('https://github.com/guilz-dev/planetz/pull/42')
    expect(result.pr.isDraft).toBe(true)
    expect(result.pr.headBranch).toBe('feature/login')
    expect(result.pr.baseBranch).toBe('main')
  })

  it('resolves default branch via git remote show or gh api without --json', async () => {
    execaMock.mockImplementation((async (cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(' ')}`
      if (joined.includes('symbolic-ref')) {
        return { exitCode: 1, stdout: '', stderr: 'not configured' } as never
      }
      if (joined.includes('remote show origin')) {
        return { exitCode: 0, stdout: '  HEAD branch: develop\n', stderr: '' } as never
      }
      return { exitCode: 0, stdout: '', stderr: '' } as never
    }) as never)

    const result = await service.checkBranch(createContext(), 'feature/login')

    expect(result).toEqual({ exists: true, defaultBaseBranch: 'develop' })
    assertNoJsonFlags()
  })
})
