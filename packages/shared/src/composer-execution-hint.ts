import YAML from 'yaml'

export interface WorkflowStepProviderRef {
  stepName: string
  provider: string
}

function stepName(step: Record<string, unknown>): string {
  const name = step.name
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : '(unnamed)'
}

function isWorkflowCallStep(step: Record<string, unknown>): boolean {
  if (step.kind === 'workflow_call') return true
  return typeof step.call === 'string' && step.call.length > 0
}

function nestedStepArrays(step: Record<string, unknown>): Array<Record<string, unknown>[]> {
  const arrays: Array<Record<string, unknown>[]> = []
  for (const key of ['parallel', 'arpeggio', 'team_leader'] as const) {
    const value = step[key]
    if (Array.isArray(value)) {
      arrays.push(
        value.filter(
          (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
        ),
      )
    }
  }
  return arrays
}

function walkSteps(steps: unknown, out: WorkflowStepProviderRef[]): void {
  if (!Array.isArray(steps)) return
  for (const raw of steps) {
    if (typeof raw !== 'object' || raw === null) continue
    const step = raw as Record<string, unknown>
    if (isWorkflowCallStep(step)) {
      continue
    }
    const provider = step.provider
    if (typeof provider === 'string' && provider.trim().length > 0) {
      out.push({ stepName: stepName(step), provider: provider.trim() })
    }
    for (const nested of nestedStepArrays(step)) {
      walkSteps(nested, out)
    }
  }
}

/** Collect explicit `steps[].provider` values (nested parallel/arpeggio included). */
export function extractWorkflowStepProviders(yaml: string): WorkflowStepProviderRef[] {
  const out: WorkflowStepProviderRef[] = []
  try {
    const root = (YAML.parse(yaml) ?? {}) as Record<string, unknown>
    walkSteps(root.steps, out)
  } catch {
    return []
  }
  return out
}

export interface ComposerStepProviderConflict {
  stepName: string
  stepProvider: string
}

/** Steps whose pinned provider differs from the Add Task override. */
export function findStepProviderConflicts(
  taskProvider: string,
  stepProviders: readonly WorkflowStepProviderRef[],
): ComposerStepProviderConflict[] {
  const normalized = taskProvider.trim()
  if (normalized.length === 0) return []
  const conflicts: ComposerStepProviderConflict[] = []
  for (const step of stepProviders) {
    if (step.provider.trim() !== normalized) {
      conflicts.push({ stepName: step.stepName, stepProvider: step.provider })
    }
  }
  return conflicts
}

export interface ComposerExecutionHintInput {
  /** Provider override from Add Task (trimmed). */
  taskProvider: string
  workflowYaml?: string
}

export interface ComposerExecutionHint {
  taskProvider: string
  conflicts: ComposerStepProviderConflict[]
  /** Distinct step providers that will run instead of `taskProvider`. */
  effectiveStepProviders: string[]
}

/** When Add Task overrides provider, detect workflow steps that pin a different provider. */
export function evaluateComposerExecutionHint(
  input: ComposerExecutionHintInput,
): ComposerExecutionHint | null {
  const taskProvider = input.taskProvider.trim()
  if (taskProvider.length === 0) return null
  const yaml = input.workflowYaml?.trim() ?? ''
  if (yaml.length === 0) return null
  const conflicts = findStepProviderConflicts(taskProvider, extractWorkflowStepProviders(yaml))
  if (conflicts.length === 0) return null
  const effectiveStepProviders = [...new Set(conflicts.map((c) => c.stepProvider))]
  return { taskProvider, conflicts, effectiveStepProviders }
}
