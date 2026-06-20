import './workspace-runtime-test-mocks.js'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookServerStartError } from '../integrations/hook-server-errors.js'
import { initializeWorkspace } from '../lib/workspace-init.js'
import { ensureIsolatedTaktWorkspace } from '../planetz/isolated-takt-workspace.js'
import { BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML } from '../takt/builtin-workflow-yaml.js'
import type { WatchManager } from '../takt/watch-manager.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'
import {
  applyCanonicalImportMock,
  configForTest,
  createWorkspaceRuntimeStack,
  ensureEmptyEngineConfigIfMissingMock,
  ensureProductBuiltinWorkflowsMock,
  migratePendingTasksToDirectExecutionIfNeededMock,
  previewCanonicalImportMock,
  resolveSidecarPathsMock,
  watchStartMock,
  watchStopMock,
  watchSyncConnectionMock,
} from './workspace-runtime-test-port.js'

function configWithHookEnabled(): UiConfig {
  return {
    ...configForTest(),
    integrations: {
      hookServer: { enabled: true, port: 17_840 },
      adapters: [
        { id: 'cursor', enabled: false },
        { id: 'codex', enabled: false },
        { id: 'claude', enabled: false },
      ],
    },
  }
}

describe('WorkspaceOpenService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.PLANETZ_ENQUEUE_MODE
    delete process.env.PLANETZ_MIGRATE_PENDING_TO_DIRECT
  })

  it('does not preview canonical import again after prompt was seen for the workspace', async () => {
    previewCanonicalImportMock.mockResolvedValue({ engineConfig: true, workflows: ['default'] })
    const { open, port } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })

    await open.openWorkspace('/tmp/ws')

    expect(previewCanonicalImportMock).not.toHaveBeenCalled()
    expect(port.canonicalImportOffer).toBeNull()
  })

  it('persists canonical import prompt seen flag when dismissed', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    port.workspacePath = '/tmp/ws'
    port.sidecarPaths = mockSidecarPaths('/tmp/ws/.orbit')

    await open.dismissCanonicalImport()

    expect(port.persistUiState).toHaveBeenCalledWith({ canonicalImportPromptSeen: true })
    expect(ensureEmptyEngineConfigIfMissingMock).toHaveBeenCalledWith(port.sidecarPaths)
    expect(port.canonicalImportOffer).toBeNull()
  })

  it('persists canonical import prompt seen flag when confirmed and restarts watch when running', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    port.workspacePath = '/tmp/ws'
    port.sidecarPaths = mockSidecarPaths('/tmp/ws/.orbit')
    port.config = configForTest()
    port.canonicalImportOffer = { engineConfig: true, workflows: ['default'] }
    port.isolatedTaktWorkspace = {
      mainWorkspacePath: '/tmp/ws',
      isolatedRepoPath: '/tmp/ws/.isolated-repo',
      lastBaseRef: null,
    }
    port.watchManager = {
      start: watchStartMock,
      stop: watchStopMock,
      syncConnection: watchSyncConnectionMock,
    } as unknown as WatchManager
    watchSyncConnectionMock.mockResolvedValue('running')
    watchStopMock.mockResolvedValue('stopped')
    watchStartMock.mockResolvedValue('running')

    await open.confirmCanonicalImport({ importHomeGlobal: true })

    expect(applyCanonicalImportMock).toHaveBeenCalledWith(
      '/tmp/ws',
      port.config,
      port.sidecarPaths,
      { engineConfig: true, workflows: ['default'], importHomeGlobal: true },
      { taktRepoPath: '/tmp/ws/.isolated-repo' },
    )
    expect(port.persistUiState).toHaveBeenCalledWith({ canonicalImportPromptSeen: true })
    expect(port.canonicalImportOffer).toBeNull()
    expect(watchStopMock).toHaveBeenCalled()
    expect(watchStartMock).toHaveBeenCalled()
  })

  it('applies global ui preferences when opening a workspace', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    const initializeGlobalUiPreferencesMock = port.workspaceSessionStore
      .initializeGlobalUiPreferences as unknown as {
      mockResolvedValue: (value: unknown) => void
    }
    initializeGlobalUiPreferencesMock.mockResolvedValue({
      theme: 'supernova',
      counterPackEnabled: true,
      language: 'ja',
    })

    await open.openWorkspace('/tmp/ws')

    expect(port.config?.ui.theme).toBe('supernova')
    expect(port.config?.ui.counterPackEnabled).toBe(true)
    expect(port.config?.ui.language).toBe('ja')
  })

  it('skips task normalization during open by default', async () => {
    const { open } = createWorkspaceRuntimeStack()

    await open.openWorkspace('/tmp/ws')

    expect(migratePendingTasksToDirectExecutionIfNeededMock).not.toHaveBeenCalled()
  })

  it('normalizes tasks when PLANETZ_MIGRATE_PENDING_TO_DIRECT=1', async () => {
    process.env.PLANETZ_MIGRATE_PENDING_TO_DIRECT = '1'
    const { open } = createWorkspaceRuntimeStack()

    await open.openWorkspace('/tmp/ws')

    expect(migratePendingTasksToDirectExecutionIfNeededMock).toHaveBeenCalledWith(
      '/tmp/ws/.isolated-repo',
      expect.any(Object),
    )
  })

  it('does not normalize tasks when package_writer enqueue mode without migrate env', async () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'package_writer'
    const { open } = createWorkspaceRuntimeStack()

    await open.openWorkspace('/tmp/ws')

    expect(migratePendingTasksToDirectExecutionIfNeededMock).not.toHaveBeenCalled()
  })

  it('skips pending-task normalization when mock queue is enabled', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    port.mockQueueEnabled = () => true

    await open.openWorkspace('/tmp/ws')

    expect(migratePendingTasksToDirectExecutionIfNeededMock).not.toHaveBeenCalled()
  })

  it('ensures product builtin workflows before previewing canonical import', async () => {
    const { open } = createWorkspaceRuntimeStack()

    await open.openWorkspace('/tmp/ws')

    expect(ensureProductBuiltinWorkflowsMock).toHaveBeenCalledWith(
      '/tmp/ws',
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    )
    expect(ensureProductBuiltinWorkflowsMock.mock.invocationCallOrder[0]).toBeLessThan(
      previewCanonicalImportMock.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    )
  })

  it('cleans leaked ollama-chat canonical file when it exactly matches builtin fallback yaml', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'planetz-open-cleanup-'))
    const sidecarPaths = mockSidecarPaths(join(workspacePath, '.orbit'))
    const leakedPath = join(sidecarPaths.planetzWorkflowsDir, 'ollama-chat.yaml')
    try {
      await mkdir(sidecarPaths.planetzWorkflowsDir, { recursive: true })
      await writeFile(leakedPath, BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML, 'utf8')
      const { open } = createWorkspaceRuntimeStack()
      resolveSidecarPathsMock.mockResolvedValueOnce(sidecarPaths)

      await open.openWorkspace(workspacePath)

      await expect(access(leakedPath)).rejects.toBeDefined()
    } finally {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('does not clean ollama-chat canonical file when workspace copy differs from builtin yaml', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'planetz-open-no-cleanup-'))
    const sidecarPaths = mockSidecarPaths(join(workspacePath, '.orbit'))
    const leakedPath = join(sidecarPaths.planetzWorkflowsDir, 'ollama-chat.yaml')
    try {
      await mkdir(sidecarPaths.planetzWorkflowsDir, { recursive: true })
      await writeFile(leakedPath, `${BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML}\n# user-edited\n`, 'utf8')
      const { open } = createWorkspaceRuntimeStack()
      resolveSidecarPathsMock.mockResolvedValueOnce(sidecarPaths)

      await open.openWorkspace(workspacePath)

      await expect(access(leakedPath)).resolves.toBeUndefined()
    } finally {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('continues opening workspace when global ui initialization fails', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    const initializeGlobalUiPreferencesMock = port.workspaceSessionStore
      .initializeGlobalUiPreferences as unknown as {
      mockRejectedValueOnce: (value: unknown) => void
    }
    initializeGlobalUiPreferencesMock.mockRejectedValueOnce(new Error('userData unavailable'))

    await expect(open.openWorkspace('/tmp/ws')).resolves.toBeDefined()
    expect(port.config?.ui.theme).toBe(configForTest().ui.theme)
    expect(port.config?.ui.counterPackEnabled).toBe(configForTest().ui.counterPackEnabled)
    expect(port.config?.ui.language).toBe(configForTest().ui.language)
  })

  it('teardown clears connector and closes sqlite via watch teardown', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    await open.openWorkspace('/tmp/ws')
    expect(port.connector).not.toBeNull()

    await open.teardownWorkspaceRuntime()

    expect(port.connector).toBeNull()
    expect(port.watchManager).toBeNull()
    expect(port.stopRunsWatcher).toBeNull()
    expect(port.workspacePath).toBeNull()
    expect(port.sidecarPaths).toBeNull()
    expect(port.config).toBeNull()
    expect(port.connection).toEqual({ cli: 'unknown', watch: 'unknown' })
    expect(port.uiState).toEqual({})
    expect(port.mockTasks).toEqual([])
    expect(port.chainCoordinator.reset).toHaveBeenCalled()
    expect(port.composerAssistantService.clearAll).toHaveBeenCalled()
  })

  it('resets session fields when open fails after teardown', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    await open.openWorkspace('/tmp/ws')
    expect(port.workspacePath).toBe('/tmp/ws')

    vi.mocked(ensureIsolatedTaktWorkspace).mockRejectedValueOnce(new Error('isolated setup failed'))

    await expect(open.openWorkspace('/tmp/other-ws')).rejects.toThrow('isolated setup failed')

    expect(port.workspacePath).toBeNull()
    expect(port.sidecarPaths).toBeNull()
    expect(port.config).toBeNull()
    expect(port.connection).toEqual({ cli: 'unknown', watch: 'unknown' })
    expect(port.uiState).toEqual({})
    expect(port.mockTasks).toEqual([])
  })

  it('openRecentWorkspace removes stale recent entry when path is missing', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    const remove = vi.fn(async () => [])
    port.workspaceSessionStore.pathExists = vi.fn(async () => false)
    port.workspaceSessionStore.remove = remove

    await expect(open.openRecentWorkspace('/gone/ws')).rejects.toThrow(
      'Workspace not found: /gone/ws',
    )
    expect(remove).toHaveBeenCalledWith('/gone/ws')
  })

  it('serializes overlapping openWorkspace calls', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    let releaseFirstLoadConfig!: () => void
    let firstLoadConfigBlocked = false
    const firstLoadConfigReached = new Promise<void>((resolve) => {
      port.sidecarStore.loadConfig = vi.fn(async () => {
        if (!firstLoadConfigBlocked) {
          firstLoadConfigBlocked = true
          resolve()
          await new Promise<void>((resume) => {
            releaseFirstLoadConfig = resume
          })
        }
        return configForTest()
      })
    })

    const firstOpen = open.openWorkspace('/tmp/ws-a')
    await firstLoadConfigReached

    const secondOpen = open.openWorkspace('/tmp/ws-b')
    await Promise.resolve()

    expect(port.sidecarStore.loadConfig).toHaveBeenCalledTimes(1)

    if (!firstLoadConfigBlocked) {
      throw new Error('Expected first loadConfig call to block before releasing it')
    }
    releaseFirstLoadConfig()

    await expect(firstOpen).resolves.toBeDefined()
    await expect(secondOpen).resolves.toBeDefined()
    expect(port.sidecarStore.loadConfig).toHaveBeenCalledTimes(2)
    expect(port.workspacePath).toBe('/tmp/ws-b')
  })

  it('openLastWorkspaceIfAvailable returns null when there is no last path', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    port.workspaceSessionStore.getLastOpenedPath = vi.fn(async () => null)

    await expect(open.openLastWorkspaceIfAvailable()).resolves.toBeNull()
  })

  it('openLastWorkspaceIfAvailable removes missing path and returns null', async () => {
    const { open, port } = createWorkspaceRuntimeStack()
    const remove = vi.fn(async () => [])
    port.workspaceSessionStore.getLastOpenedPath = vi.fn(async () => '/gone/ws')
    port.workspaceSessionStore.pathExists = vi.fn(async () => false)
    port.workspaceSessionStore.remove = remove

    await expect(open.openLastWorkspaceIfAvailable()).resolves.toBeNull()
    expect(remove).toHaveBeenCalledWith('/gone/ws')
  })

  it('applies rolled-back config and continues when hook restore hits EADDRINUSE', async () => {
    const enabled = configWithHookEnabled()
    const disabled = configWithHookEnabled()
    const hookServer = disabled.integrations?.hookServer
    if (hookServer) hookServer.enabled = false

    const { open, port } = createWorkspaceRuntimeStack()
    port.sidecarStore.loadConfig = vi.fn(async () => enabled)
    port.integrationsService.toggleHookServer = vi.fn().mockRejectedValue(
      new HookServerStartError({
        code: 'EADDRINUSE',
        port: 17_840,
        configAfterRollback: disabled,
      }),
    )

    process.env.NODE_ENV_ELECTRON_VITE = 'development'
    await open.openWorkspace('/tmp/ws')
    expect(port.config?.integrations?.hookServer.enabled).toBe(false)
    delete process.env.NODE_ENV_ELECTRON_VITE
  })

  it('initializeWorkspace clears bootstrap override and refreshes state', async () => {
    const { open, port, facade } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })
    await facade.openWorkspace('/tmp/ws')
    port.bootstrapOverride = 'non_takt'

    await open.initializeWorkspace(true)

    expect(initializeWorkspace).toHaveBeenCalledWith('/tmp/ws', true, '/tmp/ws/.isolated-repo')
    expect(port.bootstrapOverride).toBeNull()
    expect(port.refreshState).toHaveBeenCalled()
  })
})
