import type { EngineConfig } from '@planetz/shared'
import type { RuntimeWorkflowResolution } from './takt-runtime-adapter.js'

/** Loads canonical execution defaults for `TaktConnectorCli`. */
export interface ExecutionProfileContext {
  loadEngineConfig: () => Promise<EngineConfig>
  resolveWorkflowForRuntime: (
    engine: EngineConfig,
    workflowNameOrPath?: string,
  ) => Promise<RuntimeWorkflowResolution>
  buildRuntimeEnv: (engine: EngineConfig) => Promise<Record<string, string>>
}
