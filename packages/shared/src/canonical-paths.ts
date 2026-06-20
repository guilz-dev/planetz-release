import { SIDECAR_DIR_NAME } from './constants.js'

/** Planetz-owned engine policy file under the workspace sidecar. */
export const PLANETZ_ENGINE_CONFIG_FILENAME = 'engine-config.yaml'

/** Planetz-owned workflow directory under the workspace sidecar. */
export const PLANETZ_WORKFLOWS_DIRNAME = 'workflows'

/** Planetz-owned per-role provider/model overrides under the workspace sidecar. */
export const PLANETZ_AGENTS_DIRNAME = 'agents'

export const PLANETZ_AGENT_OVERRIDES_FILENAME = 'overrides.yaml'

export function planetzEngineConfigRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${PLANETZ_ENGINE_CONFIG_FILENAME}`
}

export function planetzAgentOverridesRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${PLANETZ_AGENTS_DIRNAME}/${PLANETZ_AGENT_OVERRIDES_FILENAME}`
}

export function planetzWorkflowRelPath(workflowName: string): string {
  const trimmed = workflowName.trim()
  return `${SIDECAR_DIR_NAME}/${PLANETZ_WORKFLOWS_DIRNAME}/${trimmed}.yaml`
}

export function planetzWorkflowsDirRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${PLANETZ_WORKFLOWS_DIRNAME}`
}
