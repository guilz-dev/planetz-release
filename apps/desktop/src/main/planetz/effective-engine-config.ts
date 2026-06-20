import { buildEffectiveEngineConfig, type EngineConfig } from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { AgentOverridesStore } from './agent-overrides-store.js'
import type { EngineConfigStore } from './engine-config-store.js'

export async function loadEffectiveEngineConfig(
  engineStore: EngineConfigStore,
  overridesStore: AgentOverridesStore,
  paths: SidecarPaths,
): Promise<EngineConfig> {
  const [engine, overrides] = await Promise.all([
    engineStore.load(paths),
    overridesStore.load(paths),
  ])
  return buildEffectiveEngineConfig(engine, overrides)
}
