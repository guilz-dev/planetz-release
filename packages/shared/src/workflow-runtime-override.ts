/** Suffix for per-run materialized workflow names under sidecar runtime-workflows. */
export const RUNTIME_WORKFLOW_OVERRIDE_SUFFIX = '__modified'
const RUNTIME_WORKFLOW_OVERRIDE_VARIANT_PREFIX = `${RUNTIME_WORKFLOW_OVERRIDE_SUFFIX}-rt-`
const RUNTIME_WORKFLOW_OVERRIDE_VARIANT_REGEX = /^([0-9a-f]{8})$/

export function stripRuntimeWorkflowOverrideSuffix(workflowName: string): string {
  if (workflowName.endsWith(RUNTIME_WORKFLOW_OVERRIDE_SUFFIX)) {
    return workflowName.slice(0, -RUNTIME_WORKFLOW_OVERRIDE_SUFFIX.length)
  }
  const variantIndex = workflowName.lastIndexOf(RUNTIME_WORKFLOW_OVERRIDE_VARIANT_PREFIX)
  if (variantIndex <= 0) return workflowName
  const variant = workflowName.slice(variantIndex + RUNTIME_WORKFLOW_OVERRIDE_VARIANT_PREFIX.length)
  if (!RUNTIME_WORKFLOW_OVERRIDE_VARIANT_REGEX.test(variant)) {
    return workflowName
  }
  return workflowName.slice(0, variantIndex)
}

export function isRuntimeMaterializedWorkflowName(workflowName: string): boolean {
  const trimmed = workflowName.trim()
  return trimmed.length > 0 && stripRuntimeWorkflowOverrideSuffix(trimmed) !== trimmed
}

export function runtimeWorkflowOverrideName(baseWorkflow: string, variant?: string): string {
  const trimmedVariant = variant?.trim().toLowerCase()
  if (!trimmedVariant) return `${baseWorkflow}${RUNTIME_WORKFLOW_OVERRIDE_SUFFIX}`
  if (!RUNTIME_WORKFLOW_OVERRIDE_VARIANT_REGEX.test(trimmedVariant)) {
    throw new Error('runtime workflow override variant must be 8 lowercase hex characters')
  }
  return `${baseWorkflow}${RUNTIME_WORKFLOW_OVERRIDE_VARIANT_PREFIX}${trimmedVariant}`
}
