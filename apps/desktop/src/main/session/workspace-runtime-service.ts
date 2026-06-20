import type {
  AppState,
  ConnectionState,
  RecentWorkspace,
  WorkspaceBootstrapStatus,
} from '@planetz/shared'
import { WorkspaceOpenService } from './workspace-open-service.js'
import { WorkspaceRuntimeEnvService } from './workspace-runtime-env-service.js'
import type { WorkspaceRuntimePort } from './workspace-runtime-port.js'
import { WorkspaceWatchService } from './workspace-watch-service.js'

export type { WorkspaceRuntimePort } from './workspace-runtime-port.js'

export class WorkspaceRuntimeService {
  private readonly env: WorkspaceRuntimeEnvService
  private readonly watch: WorkspaceWatchService
  private readonly open: WorkspaceOpenService

  constructor(port: WorkspaceRuntimePort) {
    this.env = new WorkspaceRuntimeEnvService(port)
    this.watch = new WorkspaceWatchService(port, this.env)
    this.open = new WorkspaceOpenService(port, this.env, this.watch)
  }

  openWorkspace(workspacePath: string): Promise<AppState> {
    return this.open.openWorkspace(workspacePath)
  }

  openRecentWorkspace(path: string): Promise<{ path: string; state: AppState }> {
    return this.open.openRecentWorkspace(path)
  }

  listRecentWorkspaces(): Promise<RecentWorkspace[]> {
    return this.open.listRecentWorkspaces()
  }

  removeRecentWorkspace(path: string): Promise<RecentWorkspace[]> {
    return this.open.removeRecentWorkspace(path)
  }

  openLastWorkspaceIfAvailable(): Promise<{ path: string; state: AppState } | null> {
    return this.open.openLastWorkspaceIfAvailable()
  }

  teardownWorkspaceRuntime(): Promise<void> {
    return this.open.teardownWorkspaceRuntime()
  }

  confirmCanonicalImport(options?: { importHomeGlobal?: boolean }): Promise<AppState> {
    return this.open.confirmCanonicalImport(options)
  }

  dismissCanonicalImport(): Promise<AppState> {
    return this.open.dismissCanonicalImport()
  }

  setBootstrapOverride(status: WorkspaceBootstrapStatus): Promise<AppState> {
    return this.open.setBootstrapOverride(status)
  }

  initializeWorkspace(createTaktDir: boolean): Promise<AppState> {
    return this.open.initializeWorkspace(createTaktDir)
  }

  syncRuntimeWatchers(): Promise<void> {
    return this.watch.syncRuntimeWatchers()
  }

  refreshConnection(): Promise<ConnectionState> {
    return this.watch.refreshConnection()
  }

  startWatch(): Promise<ConnectionState> {
    return this.watch.startWatch()
  }

  stopWatch(): Promise<ConnectionState> {
    return this.watch.stopWatch()
  }

  restartWatchIfRunning(): Promise<void> {
    return this.watch.restartWatchIfRunning()
  }

  resolveTaktRuntimeEnv(): Promise<Record<string, string>> {
    return this.env.resolveTaktRuntimeEnv()
  }

  requireIsolatedRepoPath(): string {
    return this.env.requireIsolatedRepoPath()
  }

  captureChatApplyBaseRef(): Promise<string> {
    return this.env.captureChatApplyBaseRef()
  }
}
