import type { WorkflowDraft, WorkflowFormMode } from './workflow-draft-types.js'
import { hasRoundTripLoss } from './workflow-form-safety.js'
import { parseWorkflowYaml } from './workflow-parse.js'

export function workflowFormMode(draft: WorkflowDraft, sourceYaml?: string): WorkflowFormMode {
  if (draft.parseError) return 'yaml-only'
  if (draft.unsupportedKeys.length > 0) return 'yaml-only'
  if (sourceYaml?.trim() && hasRoundTripLoss(sourceYaml)) return 'yaml-only'
  if (draft.steps.some((s) => s.special)) return 'partial'
  return 'full'
}

export function workflowFormBanner(draft: WorkflowDraft, sourceYaml?: string): string | null {
  if (workflowFormMode(draft, sourceYaml) !== 'partial') return null
  const kinds = [...new Set(draft.steps.map((s) => s.special).filter(Boolean))]
  if (kinds.length === 0) return null
  const yamlDrawerKinds = kinds.filter((k) => k !== 'workflow_call')
  const parts: string[] = []
  if (kinds.includes('workflow_call')) {
    parts.push('workflow_call steps are editable on the Steps tab')
  }
  if (yamlDrawerKinds.length > 0) {
    parts.push(`${yamlDrawerKinds.join(', ')} steps need the YAML drawer (⌘E)`)
  }
  return `${parts.join('; ')}. Overview and normal steps remain editable.`
}

/** Derive YAML-only banner text from parsed workflow YAML (shared by editor + drawer). */
export function readonlyReasonForYaml(yaml: string): string | null {
  const parsed = parseWorkflowYaml(yaml)
  return readonlyReasonForDraft(parsed, yaml)
}

export function readonlyReasonForDraft(draft: WorkflowDraft, sourceYaml?: string): string | null {
  if (workflowFormMode(draft, sourceYaml) !== 'yaml-only') return null

  if (draft.parseError) return `YAML parse failed: ${draft.parseError}`

  if (draft.unsupportedKeys.length > 0) {
    const preview = draft.unsupportedKeys.slice(0, 3).join(', ')
    const suffix = draft.unsupportedKeys.length > 3 ? '…' : ''
    return `Unsupported keys: ${preview}${suffix}`
  }

  if (sourceYaml?.trim() && hasRoundTripLoss(sourceYaml)) {
    return 'Form conversion would lose structure — edit in YAML only'
  }

  return 'This workflow is not supported by the form editor'
}

export function workflowSummaryFormFields(yaml: string): {
  formEditable: boolean
  formMode: WorkflowFormMode
} {
  const draft = parseWorkflowYaml(yaml)
  const formMode = workflowFormMode(draft, yaml)
  return {
    formEditable: formMode !== 'yaml-only',
    formMode,
  }
}

export function isYamlFormEditable(yaml: string): boolean {
  return workflowFormMode(parseWorkflowYaml(yaml), yaml) === 'full'
}

export function isYamlFormPartiallyEditable(yaml: string): boolean {
  return workflowFormMode(parseWorkflowYaml(yaml), yaml) !== 'yaml-only'
}
