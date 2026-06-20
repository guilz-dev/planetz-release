import type { EngineConfig } from '@planetz/shared'
import { loadEffectiveEngineConfig } from '../planetz/effective-engine-config.js'
import type { ExecutionProfileContext } from '../planetz/execution-profile-context.js'
import { prepareIsolatedTaktExecution } from '../planetz/isolated-takt-workspace.js'
import {
  buildTaktRuntimeEnv,
  resolveRuntimeWorkflow,
  watchCliOverridesFromEngine,
} from '../planetz/takt-runtime-adapter.js'
import type { TaktAgentCliOverrides } from '../takt/commands.js'
import type { WorkspaceRuntimePort } from './workspace-runtime-port.js'

export class WorkspaceRuntimeEnvService {
  constructor(private readonly port: WorkspaceRuntimePort) {}

  requireIsolatedRepoPath(): string {
    const repo = this.port.isolatedTaktWorkspace?.isolatedRepoPath
    if (!repo) throw new Error('No isolated takt workspace')
    return repo
  }

  /** Sync isolated repo to main and return the main HEAD used as Apply conflict baseline. */
  async captureChatApplyBaseRef(): Promise<string> {
    const engine = await loadEffectiveEngineConfig(
      this.port.engineConfigStore,
      this.port.agentOverridesStore,
      this.port.requireSidecarPaths(),
    )
    await this.prepareIsolatedExecution(engine)
    const baseRef = this.port.isolatedTaktWorkspace?.lastBaseRef
    if (!baseRef) {
      throw new Error('Failed to capture chat apply base ref')
    }
    return baseRef
  }

  buildExecutionProfileContext(): ExecutionProfileContext {
    return {
      loadEngineConfig: async () =>
        loadEffectiveEngineConfig(
          this.port.engineConfigStore,
          this.port.agentOverridesStore,
          this.port.requireSidecarPaths(),
        ),
      resolveWorkflowForRuntime: async (engine, workflowNameOrPath) => {
        const isolatedSidecar = await this.prepareIsolatedExecution(engine)
        return resolveRuntimeWorkflow(
          this.port.requireCanonicalWorkflowManager(),
          isolatedSidecar,
          engine,
          workflowNameOrPath,
          this.requireIsolatedRepoPath(),
        )
      },
      buildRuntimeEnv: async (engine) => {
        const isolatedSidecar = await this.prepareIsolatedExecution(engine)
        return buildTaktRuntimeEnv(isolatedSidecar, engine, this.requireIsolatedRepoPath())
      },
    }
  }

  async resolveTaktRuntimeEnv(): Promise<Record<string, string>> {
    const mainPaths = this.port.requireSidecarPaths()
    const engine = await loadEffectiveEngineConfig(
      this.port.engineConfigStore,
      this.port.agentOverridesStore,
      mainPaths,
    )
    const isolatedSidecar = await this.prepareIsolatedExecution(engine)
    return buildTaktRuntimeEnv(isolatedSidecar, engine, this.requireIsolatedRepoPath())
  }

  async resolveWatchCliOverrides(): Promise<TaktAgentCliOverrides | undefined> {
    const engine = await loadEffectiveEngineConfig(
      this.port.engineConfigStore,
      this.port.agentOverridesStore,
      this.port.requireSidecarPaths(),
    )
    return watchCliOverridesFromEngine(engine)
  }

  private async prepareIsolatedExecution(engine: EngineConfig) {
    const isolated = this.port.isolatedTaktWorkspace
    if (!isolated) throw new Error('No isolated takt workspace')
    return prepareIsolatedTaktExecution(
      isolated,
      this.port.requireSidecarPaths(),
      engine,
      this.port.requireConfig(),
    )
  }
}
