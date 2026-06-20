import { IPC_CHANNELS } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: vi.fn(),
  },
}))

import type { AppSession } from '../../app-session.js'
import type { IpcContext } from '../ipc-context.js'
import { registerGitHubIssueIpc } from '../register-github-issue-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerGitHubIssueIpc', () => {
  const fetchGitHubIssue = vi.fn()
  const listOpenGitHubIssues = vi.fn()

  const ctx = {
    session: {
      fetchGitHubIssue,
      listOpenGitHubIssues,
    } as Pick<AppSession, 'fetchGitHubIssue' | 'listOpenGitHubIssues'>,
  } as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    fetchGitHubIssue.mockReset()
    listOpenGitHubIssues.mockReset()
    registerGitHubIssueIpc(ctx)
  })

  it('routes githubIssue:listOpen to session.listOpenGitHubIssues', async () => {
    listOpenGitHubIssues.mockResolvedValue({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [
        {
          repository: { owner: 'guilz-dev', name: 'planetz' },
          number: 368,
          title: 'Sample',
          url: 'https://github.com/guilz-dev/planetz/issues/368',
          createdAt: '2026-05-31T00:00:00Z',
          state: 'open',
          labels: [],
        },
      ],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
    })
    const handler = getHandler(IPC_CHANNELS.githubIssueListOpen)
    const result = await handler(null, { after: 'cursor-0' })
    expect(listOpenGitHubIssues).toHaveBeenCalledWith({ after: 'cursor-0' })
    expect(result).toMatchObject({ items: [{ number: 368 }] })
  })

  it('rejects invalid githubIssue:listOpen input', async () => {
    const handler = getHandler(IPC_CHANNELS.githubIssueListOpen)
    await expect(handler(null, { after: '' })).rejects.toThrow(/githubIssue:listOpen/)
    expect(listOpenGitHubIssues).not.toHaveBeenCalled()
  })

  it('routes githubIssue:fetch to session.fetchGitHubIssue', async () => {
    fetchGitHubIssue.mockResolvedValue({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Sample',
      body: 'Body',
      url: 'https://github.com/guilz-dev/planetz/issues/368',
      state: 'open',
      labels: [],
    })
    const handler = getHandler(IPC_CHANNELS.githubIssueFetch)
    const result = await handler(null, { ref: 'guilz-dev/planetz#368' })
    expect(fetchGitHubIssue).toHaveBeenCalledWith({ ref: 'guilz-dev/planetz#368' })
    expect(result).toMatchObject({ number: 368, state: 'open' })
  })

  it('rejects invalid githubIssue:fetch input', async () => {
    const handler = getHandler(IPC_CHANNELS.githubIssueFetch)
    await expect(handler(null, { ref: '' })).rejects.toThrow(/githubIssue:fetch/)
    expect(fetchGitHubIssue).not.toHaveBeenCalled()
  })
})
