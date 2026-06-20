import {
  type EngineConfig,
  type EnqueueTaskInput,
  type ExecutionProfile,
  type ExecutionProfileOverrides,
  extractWorkflowExecutionDefaults,
  resolveExecutionProfile,
} from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { AgentOverridesStore } from './agent-overrides-store.js'
import { loadEffectiveEngineConfig } from './effective-engine-config.js'
import type { EngineConfigStore } from './engine-config-store.js'
import type { PlanetzWorkflowCanonicalManager } from './workflow-canonical-manager.js'

export async function workflowDefaultsForName(
  manager: PlanetzWorkflowCanonicalManager | null,
  workflowName?: string,
): Promise<ExecutionProfileOverrides | undefined> {
  const name = workflowName?.trim()
  if (!name || !manager) return undefined
  try {
    const workflow = await manager.read(name)
    return extractWorkflowExecutionDefaults(workflow.yaml)
  } catch {
    return undefined
  }
}

export async function loadEngineConfig(
  engineStore: EngineConfigStore,
  overridesStore: AgentOverridesStore,
  paths: SidecarPaths,
): Promise<EngineConfig> {
  return loadEffectiveEngineConfig(engineStore, overridesStore, paths)
}

export async function resolveExecutionProfileForEnqueue(
  engineStore: EngineConfigStore,
  overridesStore: AgentOverridesStore,
  paths: SidecarPaths,
  manager: PlanetzWorkflowCanonicalManager | null,
  input: EnqueueTaskInput,
): Promise<ExecutionProfile> {
  const engine = await loadEngineConfig(engineStore, overridesStore, paths)
  const workflowDefaults = await workflowDefaultsForName(manager, input.workflow)
  return resolveExecutionProfile(engine, input, workflowDefaults)
}
