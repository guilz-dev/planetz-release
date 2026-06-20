import './workspace-runtime-test-mocks.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceRuntimePort } from '../session/workspace-runtime-port.js'
import type { WatchManager } from '../takt/watch-manager.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'
import {
  checkTaktCliMock,
  configForTest,
  createWorkspaceRuntimeStack,
  startRunsWatcherMock,
  watchStartMock,
  watchStopMock,
  watchSyncConnectionMock,
} from './workspace-runtime-test-port.js'

describe('WorkspaceWatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('watches tasks.yaml and worktree roots for projection refresh', async () => {
    const { open, port } = createWorkspaceRuntimeStack()

    await open.openWorkspace('/tmp/ws')

    expect(startRunsWatcherMock).toHaveBeenCalledWith(
      '/tmp/ws/.isolated-repo',
      expect.anything(),
      expect.any(Function),
      {
        watchTasksYaml: true,
        additionalRoots: ['/tmp/ws/takt-worktrees', '/tmp/custom-worktree/.takt/runs'],
        fallbackPollMs: 3000,
        shouldFallbackPoll: expect.any(Function),
      },
    )
    const options = startRunsWatcherMock.mock.calls[0]?.[3] as
      | { shouldFallbackPoll?: () => boolean }
      | undefined
    expect(options?.shouldFallbackPoll?.()).toBe(true)
    port.cachedState = {
      tasks: [{ status: 'completed' }],
    } as unknown as NonNullable<WorkspaceRuntimePort['cachedState']>
    expect(options?.shouldFallbackPoll?.()).toBe(false)
  })

  it('startWatch resolves runtime env and refreshes state', async () => {
    const { watch, port, facade } = createWorkspaceRuntimeStack()
    await facade.openWorkspace('/tmp/ws')
    watchStartMock.mockResolvedValue('running')

    const connection = await watch.startWatch()

    expect(watchStartMock).toHaveBeenCalled()
    expect(connection.watch).toBe('running')
    expect(port.refreshState).toHaveBeenCalled()
  })

  it('stopWatch stops watch manager and refreshes state', async () => {
    const { watch, port, facade } = createWorkspaceRuntimeStack()
    await facade.openWorkspace('/tmp/ws')
    watchStopMock.mockResolvedValue('stopped')

    const connection = await watch.stopWatch()

    expect(watchStopMock).toHaveBeenCalled()
    expect(connection.watch).toBe('stopped')
    expect(port.refreshState).toHaveBeenCalled()
  })

  it('refreshConnection re-checks cli and syncs watch connection', async () => {
    const { watch, port, facade } = createWorkspaceRuntimeStack()
    await facade.openWorkspace('/tmp/ws')
    checkTaktCliMock.mockResolvedValue({ cli: 'ok', watch: 'stopped' })
    watchSyncConnectionMock.mockResolvedValue('stopped')

    const connection = await watch.refreshConnection()

    expect(checkTaktCliMock).toHaveBeenCalled()
    expect(connection.cli).toBe('ok')
    expect(port.refreshState).toHaveBeenCalled()
  })

  it('syncRuntimeWatchers stops running watch in mock queue mode', async () => {
    const { watch, port } = createWorkspaceRuntimeStack()
    port.workspacePath = '/tmp/ws'
    port.sidecarPaths = mockSidecarPaths('/tmp/ws/.orbit')
    port.config = configForTest()
    port.watchManager = {
      start: watchStartMock,
      stop: watchStopMock,
      syncConnection: watchSyncConnectionMock,
    } as unknown as WatchManager
    port.mockQueueEnabled = () => true
    port.connection.watch = 'running'
    watchStopMock.mockResolvedValue('stopped')

    await watch.syncRuntimeWatchers()

    expect(watchStopMock).toHaveBeenCalled()
    expect(port.connection.watch).toBe('stopped')
  })

  it('restartWatchIfRunning restarts watch only when the current connection is running', async () => {
    const { watch, port, facade } = createWorkspaceRuntimeStack()
    await facade.openWorkspace('/tmp/ws')
    watchSyncConnectionMock.mockResolvedValue('running')
    watchStopMock.mockResolvedValue('stopped')
    watchStartMock.mockResolvedValue('running')

    await watch.restartWatchIfRunning()

    expect(watchSyncConnectionMock).toHaveBeenCalledWith(port.sidecarPaths)
    expect(watchStopMock).toHaveBeenCalledWith(port.sidecarPaths)
    expect(watchStartMock).toHaveBeenCalledWith(
      port.sidecarPaths,
      expect.any(Object),
      expect.any(Object),
    )
    expect(port.connection.watch).toBe('running')
  })

  it('restartWatchIfRunning leaves watch stopped when the current connection is not running', async () => {
    const { watch, port, facade } = createWorkspaceRuntimeStack()
    await facade.openWorkspace('/tmp/ws')
    watchSyncConnectionMock.mockResolvedValue('stopped')

    await watch.restartWatchIfRunning()

    expect(watchSyncConnectionMock).toHaveBeenCalledWith(port.sidecarPaths)
    expect(watchStopMock).not.toHaveBeenCalled()
    expect(watchStartMock).not.toHaveBeenCalled()
    expect(port.connection.watch).toBe('stopped')
  })
})
