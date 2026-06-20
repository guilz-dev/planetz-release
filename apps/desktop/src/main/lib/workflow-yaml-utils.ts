import type {
  WorkflowDiagnostic,
  WorkflowFormMode,
  WorkflowOperationError,
  WorkflowStepSummary,
} from '@planetz/shared'
import { parseWorkflowYaml } from '../../shared/workflow-form/workflow-parse.js'
import { workflowSummaryFormFields } from '../../shared/workflow-form/workflow-readonly.js'

export function workflowError(
  code: WorkflowOperationError['code'],
  message: string,
  path?: string,
  diagnostics?: WorkflowDiagnostic[],
): Error & WorkflowOperationError {
  const err = new Error(message) as Error & WorkflowOperationError
  err.code = code
  err.path = path
  err.diagnostics = diagnostics
  return err
}

export function validateYamlLocally(_name: string, yaml: string): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = []
  if (!yaml.trim()) {
    diagnostics.push({
      level: 'error',
      message: 'workflow YAML is empty',
      code: 'yaml_parse_error',
    })
    return diagnostics
  }
  if (!/^\s*name\s*:/m.test(yaml)) {
    diagnostics.push({
      level: 'error',
      message: '`name:` field is missing',
      code: 'doctor_validation_error',
    })
  }
  if (!/^\s*steps\s*:/m.test(yaml)) {
    diagnostics.push({
      level: 'error',
      message: '`steps:` field is missing',
      code: 'doctor_validation_error',
    })
  }
  return diagnostics
}

export function extractWorkflowSteps(yaml: string): WorkflowStepSummary[] {
  const draft = parseWorkflowYaml(yaml)
  if (draft.parseError) return []
  return draft.steps
    .filter((step) => step.name.length > 0)
    .map((step) => ({
      name: step.name,
      ...(step.persona ? { persona: step.persona } : {}),
    }))
}

export function extractStepNames(yaml: string): string[] {
  return extractWorkflowSteps(yaml).map((s) => s.name)
}

/** @deprecated Prefer workflowSummaryFormFields — kept for legacy tests. */
export function isLikelyYamlOnlyWorkflow(yaml: string): boolean {
  return workflowSummaryFormFields(yaml).formMode === 'yaml-only'
}

export function workflowFormFieldsFromYaml(yaml: string): {
  formEditable: boolean
  formMode: WorkflowFormMode
} {
  return workflowSummaryFormFields(yaml)
}

export function extractAgentRoles(yaml: string): string[] {
  const roles = new Set<string>()
  for (const step of extractWorkflowSteps(yaml)) {
    if (step.persona) roles.add(step.persona)
  }
  return [...roles]
}

export function workflowStepSummaryFields(yaml: string): {
  steps: WorkflowStepSummary[]
  stepNames: string[]
  agentRoles: string[]
} {
  const steps = extractWorkflowSteps(yaml)
  return {
    steps,
    stepNames: steps.map((s) => s.name),
    agentRoles: extractAgentRoles(yaml),
  }
}
