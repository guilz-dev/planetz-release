import YAML from 'yaml'

export const OLLAMA_WORKFLOW_ISSUE_KINDS = [
  'allowed_tools',
  'edit',
  'required_permission_mode',
  'workflow_parse_error',
  'workflow_unavailable',
] as const

export type OllamaWorkflowIssueKind = (typeof OLLAMA_WORKFLOW_ISSUE_KINDS)[number]

export interface OllamaWorkflowCompatIssue {
  stepName: string
  kind: OllamaWorkflowIssueKind
}

export interface OllamaWorkflowCompatResult {
  compatible: boolean
  issues: OllamaWorkflowCompatIssue[]
}

function stepName(step: Record<string, unknown>): string {
  const name = step.name
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : '(unnamed)'
}

function hasNonEmptyAllowedTools(step: Record<string, unknown>): boolean {
  const tools = step.allowed_tools
  return Array.isArray(tools) && tools.length > 0
}

function incompatibleKindsForStep(step: Record<string, unknown>): OllamaWorkflowIssueKind[] {
  const kinds: OllamaWorkflowIssueKind[] = []
  if (hasNonEmptyAllowedTools(step)) kinds.push('allowed_tools')
  if (step.edit === true) kinds.push('edit')
  const rpm = step.required_permission_mode
  if (rpm === 'edit' || rpm === 'full') kinds.push('required_permission_mode')
  return kinds
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

function walkSteps(steps: unknown, issues: OllamaWorkflowCompatIssue[]): void {
  if (!Array.isArray(steps)) return
  for (const raw of steps) {
    if (typeof raw !== 'object' || raw === null) continue
    const step = raw as Record<string, unknown>
    if (isWorkflowCallStep(step)) {
      continue
    }
    for (const kind of incompatibleKindsForStep(step)) {
      issues.push({ stepName: stepName(step), kind })
    }
    for (const nested of nestedStepArrays(step)) {
      walkSteps(nested, issues)
    }
  }
}

/** Scan workflow YAML for steps incompatible with Ollama readonly execution. */
export function scanWorkflowOllamaCompatibility(yaml: string): OllamaWorkflowCompatResult {
  const issues: OllamaWorkflowCompatIssue[] = []
  try {
    const root = (YAML.parse(yaml) ?? {}) as Record<string, unknown>
    walkSteps(root.steps, issues)
  } catch {
    return {
      compatible: false,
      issues: [{ stepName: '(workflow)', kind: 'workflow_parse_error' }],
    }
  }
  return { compatible: issues.length === 0, issues }
}
