import { COMPOSER_DEFAULT_WORKFLOW_NAME } from '@planetz/shared'

/** Workflow names exposed to the renderer (e.g. from `listWorkflows`). */
export interface ComposerWorkflowOption {
  name: string
}

/**
 * Resolve Add Task workflow selection: prefer `preferred`, then composer default, then first listed.
 */
export function resolveComposerWorkflowName(
  workflows: readonly ComposerWorkflowOption[],
  preferred: string,
): string {
  const trimmed = preferred.trim()
  if (trimmed && workflows.some((w) => w.name === trimmed)) {
    return trimmed
  }
  if (workflows.some((w) => w.name === COMPOSER_DEFAULT_WORKFLOW_NAME)) {
    return COMPOSER_DEFAULT_WORKFLOW_NAME
  }
  return workflows[0]?.name ?? COMPOSER_DEFAULT_WORKFLOW_NAME
}
