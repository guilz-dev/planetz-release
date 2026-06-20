import type { ConnectionState, UiConfig } from '@planetz/shared'
import { isProcessAlive } from '../lib/process-alive.js'
import { sanitizeTasksYamlForTakt } from '../lib/tasks-yaml-takt-compat.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { WatchStateStore } from '../sidecar/watch-state-store.js'
import { type TaktAgentCliOverrides, taktWatchCommand } from './commands.js'
import { runTaktCli } from './exec-cli.js'

export class WatchManager {
  private child: ReturnType<typeof runTaktCli> | null = null
  private readonly watchStateStore = new WatchStateStore()

  constructor(
    private readonly workspacePath: string,
    private readonly config: UiConfig,
  ) {}

  async start(
    paths: SidecarPaths,
    runtimeEnv: Record<string, string> = {},
    cliOverrides?: TaktAgentCliOverrides,
  ): Promise<ConnectionState['watch']> {
    await sanitizeTasksYamlForTakt(this.workspacePath, this.config)
    const existing = await this.watchStateStore.load(paths)
    if (existing.pid && isProcessAlive(existing.pid)) {
      return 'running'
    }
    if (this.child) {
      return 'running'
    }
    const args = taktWatchCommand(cliOverrides)
    this.child = runTaktCli(this.config, args, {
      cwd: this.workspacePath,
      detached: true,
      stdio: 'ignore',
      env: runtimeEnv,
    })
    const pid = this.child.pid
    if (pid) {
      this.child.unref()
      await this.watchStateStore.save(paths, {
        pid,
        startedAt: new Date().toISOString(),
      })
    }
    void this.child.catch(() => {
      // watch process termination is handled by state sync and stop()
    })
    this.child.on('exit', () => {
      this.child = null
    })
    return 'running'
  }

  async stop(paths: SidecarPaths): Promise<ConnectionState['watch']> {
    const state = await this.watchStateStore.load(paths)
    if (state.pid) {
      try {
        process.kill(state.pid, 'SIGTERM')
      } catch {
        // already stopped
      }
    }
    if (this.child) {
      this.child.kill('SIGTERM')
      this.child = null
    }
    await this.watchStateStore.clear(paths)
    return 'stopped'
  }

  async syncConnection(paths: SidecarPaths): Promise<ConnectionState['watch']> {
    const state = await this.watchStateStore.load(paths)
    if (state.pid && isProcessAlive(state.pid)) return 'running'
    if (this.child && !this.child.killed) return 'running'
    return 'stopped'
  }

  /** Drop sidecar watch KV when the stopped PID was the recorded watch process. */
  async clearStateIfPidMatches(paths: SidecarPaths, pid: number): Promise<void> {
    const state = await this.watchStateStore.load(paths)
    if (state.pid !== pid) return
    if (isProcessAlive(pid)) return
    await this.watchStateStore.clear(paths)
    if (this.child?.pid === pid) {
      this.child = null
    }
  }

  async syncConnectionAfterStop(
    paths: SidecarPaths,
    stoppedPid: number,
  ): Promise<ConnectionState['watch']> {
    await this.clearStateIfPidMatches(paths, stoppedPid)
    return this.syncConnection(paths)
  }
}
