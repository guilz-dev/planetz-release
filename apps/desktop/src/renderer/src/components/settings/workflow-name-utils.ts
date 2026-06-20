import type { WorkflowSummary } from '@planetz/shared'
import type { WorkflowDraft } from './workflow-draft-types.js'

const DEFAULT_WORKFLOW_NAME_BASE = 'my-workflow'

export function validateWorkflowName(name: string): string | null {
  const normalized = name.trim()
  if (!normalized) return 'Workflow name is required.'
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    return 'Use kebab-case: lowercase letters, numbers, and hyphen only.'
  }
  return null
}

export function projectWorkflowNames(workflows: WorkflowSummary[]): Set<string> {
  return new Set(workflows.filter((w) => w.source === 'project').map((w) => w.name))
}

export function isDuplicateProjectWorkflowName(
  name: string,
  workflows: WorkflowSummary[],
): boolean {
  const normalized = name.trim()
  return projectWorkflowNames(workflows).has(normalized)
}

/** Suggest a unique project workflow name; increments `-2`, `-3`, … when the base is taken. */
export function validateInitialStep(draft: WorkflowDraft): string | null {
  const step = draft.initialStep?.trim()
  if (!step) return 'Initial step is required.'
  const names = draft.steps.map((s) => s.name).filter(Boolean)
  if (names.length > 0 && !names.includes(step)) {
    return 'Initial step must match an existing step name.'
  }
  return null
}

export function suggestDefaultWorkflowName(
  workflows: WorkflowSummary[],
  base = DEFAULT_WORKFLOW_NAME_BASE,
): string {
  const taken = projectWorkflowNames(workflows)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
