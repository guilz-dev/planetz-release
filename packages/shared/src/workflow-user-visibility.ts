import { isSystemTierBuiltinWorkflow } from './builtin-workflow-tier.js'

export interface WorkflowUserVisibilityOptions {
  /**
   * Preserve one hidden workflow name for legacy selection compatibility.
   * The preserved name remains visible even when it is system-tier.
   */
  preserveSelectedName?: string
}

export function isUserVisibleWorkflowName(
  name: string,
  options?: WorkflowUserVisibilityOptions,
): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0) return false
  if (!isSystemTierBuiltinWorkflow(trimmed)) return true
  return options?.preserveSelectedName?.trim() === trimmed
}

export function filterUserVisibleWorkflows<T extends { name: string }>(
  workflows: ReadonlyArray<T>,
  options?: WorkflowUserVisibilityOptions,
): T[] {
  return workflows.filter((workflow) => isUserVisibleWorkflowName(workflow.name, options))
}
