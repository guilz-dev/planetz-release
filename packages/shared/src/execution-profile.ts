import { readEffortFromEngineConfig } from './engine-config-effort.js'
import type { EngineConfig } from './engine-config-schema.js'

/** Runtime provider/model/effort resolved for a single task execution. */
export interface ExecutionProfile {
  provider?: string
  model?: string
  effort?: string
}

export interface ExecutionProfileOverrides {
  provider?: string
  model?: string
  effort?: string
}

/**
 * Resolve provider/model for one execution.
 * Precedence: task/UI overrides → workflow YAML defaults → engine-config.
 */
export function resolveExecutionProfile(
  engineConfig: EngineConfig | null | undefined,
  overrides?: ExecutionProfileOverrides,
  workflowDefaults?: ExecutionProfileOverrides,
): ExecutionProfile {
  const provider =
    overrides?.provider?.trim() ||
    workflowDefaults?.provider?.trim() ||
    engineConfig?.provider?.trim()
  const model =
    overrides?.model?.trim() || workflowDefaults?.model?.trim() || engineConfig?.model?.trim()
  const effort =
    overrides?.effort?.trim() ||
    workflowDefaults?.effort?.trim() ||
    readEffortFromEngineConfig(engineConfig)
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {}),
  }
}

/** Provider/model for workflow auto-routing before a workflow is selected. */
export function resolveRoutingExecutionProfile(
  engineConfig: EngineConfig | null | undefined,
  overrides?: ExecutionProfileOverrides,
): ExecutionProfile {
  return resolveExecutionProfile(engineConfig, overrides)
}

/** Drop override fields that match the resolved profile (no-op overrides). */
export function diffExecutionOverrides(
  draft: ExecutionProfileOverrides,
  resolved: ExecutionProfile,
): ExecutionProfileOverrides {
  const provider = draft.provider?.trim()
  const model = draft.model?.trim()
  const resolvedProvider = resolved.provider?.trim()
  const resolvedModel = resolved.model?.trim()
  return {
    ...(provider && provider !== resolvedProvider ? { provider } : {}),
    ...(model && model !== resolvedModel ? { model } : {}),
  }
}
