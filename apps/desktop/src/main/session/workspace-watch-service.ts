import type { ConnectionState } from '@planetz/shared'
import { resolveRunsWatcherAdditionalRoots, startRunsWatcher } from '../lib/runs-watcher.js'
import { readTaskRunEventSources } from '../lib/tasks-yaml-reader.js'
import { sanitizeTasksYamlForTakt } from '../lib/tasks-yaml-takt-compat.js'
import { checkTaktCli } from '../takt/connection-check.js'
import type { WorkspaceRuntimeEnvService } from './workspace-runtime-env-service.js'
import type { WorkspaceRuntimePort } from './workspace-runtime-port.js'

const WATCH_FALLBACK_POLL_MS = 3000

export class WorkspaceWatchService {
  constructor(
    private readonly port: WorkspaceRuntimePort,
    private readonly env: WorkspaceRuntimeEnvService,
  ) {}

  async teardownWatchResources(): Promise<void> {
    this.port.stopRunsWatcher?.()
    this.port.stopRunsWatcher = null
    if (this.port.watchManager && this.port.sidecarPaths) {
      await this.port.watchManager.stop(this.port.sidecarPaths).catch(() => {})
    }
    this.port.watchManager = null
  }

  async syncRuntimeWatchers(): Promise<void> {
    if (
      !this.port.workspacePath ||
      !this.port.sidecarPaths ||
      !this.port.config ||
      !this.port.watchManager
    ) {
      return
    }
    if (!this.port.mockQueueEnabled()) {
      await sanitizeTasksYamlForTakt(this.env.requireIsolatedRepoPath(), this.port.config)
    }
    const paths = this.port.sidecarPaths
    this.port.stopRunsWatcher?.()
    this.port.stopRunsWatcher = null

    if (this.port.mockQueueEnabled()) {
      if (this.port.connection.watch === 'running') {
        this.port.connection.watch = await this.port.watchManager.stop(paths)
      } else {
        this.port.connection.watch = await this.port.watchManager.syncConnection(paths)
      }
      return
    }

    const isolatedRepo = this.env.requireIsolatedRepoPath()
    const runSources = await readTaskRunEventSources(isolatedRepo, this.port.config)
    const additionalRoots = resolveRunsWatcherAdditionalRoots(
      isolatedRepo,
      runSources.additionalRunRoots,
    )
    this.port.stopRunsWatcher = startRunsWatcher(
      isolatedRepo,
      this.port.config,
      () => {
        void this.port.refreshAndNotify()
      },
      {
        watchTasksYaml: true,
        additionalRoots,
        fallbackPollMs: WATCH_FALLBACK_POLL_MS,
        shouldFallbackPoll: () => {
          const tasks = this.port.cachedState?.tasks
          return !tasks || tasks.some((task) => task.status === 'running')
        },
      },
    )
    if (this.port.config.watch.autoStart) {
      const runtimeEnv = await this.env.resolveTaktRuntimeEnv()
      const cliOverrides = await this.env.resolveWatchCliOverrides()
      this.port.connection.watch = await this.port.watchManager.start(
        paths,
        runtimeEnv,
        cliOverrides,
      )
    } else {
      this.port.connection.watch = await this.port.watchManager.syncConnection(paths)
    }
  }

  async refreshConnection(): Promise<ConnectionState> {
    if (!this.port.config) return this.port.connection
    this.port.connection = await checkTaktCli(this.port.config)
    if (this.port.watchManager && this.port.sidecarPaths) {
      this.port.connection.watch = await this.port.watchManager.syncConnection(
        this.port.sidecarPaths,
      )
    }
    await this.port.refreshState()
    return this.port.connection
  }

  async startWatch(): Promise<ConnectionState> {
    const paths = this.port.requireSidecarPaths()
    if (!this.port.watchManager) throw new Error('No workspace open')
    const runtimeEnv = await this.env.resolveTaktRuntimeEnv()
    const cliOverrides = await this.env.resolveWatchCliOverrides()
    this.port.connection.watch = await this.port.watchManager.start(paths, runtimeEnv, cliOverrides)
    await this.port.refreshState()
    return this.port.connection
  }

  async stopWatch(): Promise<ConnectionState> {
    const paths = this.port.requireSidecarPaths()
    if (!this.port.watchManager) throw new Error('No workspace open')
    this.port.connection.watch = await this.port.watchManager.stop(paths)
    await this.port.refreshState()
    return this.port.connection
  }

  async restartWatchIfRunning(): Promise<void> {
    if (!this.port.watchManager || !this.port.sidecarPaths) return
    const current = await this.port.watchManager.syncConnection(this.port.sidecarPaths)
    this.port.connection.watch = current
    if (current !== 'running') return
    await this.port.watchManager.stop(this.port.sidecarPaths)
    const runtimeEnv = await this.env.resolveTaktRuntimeEnv()
    const cliOverrides = await this.env.resolveWatchCliOverrides()
    this.port.connection.watch = await this.port.watchManager.start(
      this.port.sidecarPaths,
      runtimeEnv,
      cliOverrides,
    )
  }
}
