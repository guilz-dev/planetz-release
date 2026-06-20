import { facetManagedPath } from '@planetz/shared'
import YAML from 'yaml'
import type { FacetKind, SectionMap, StepDraft, WorkflowDraft } from './workflow-draft-types.js'
import { serializeRuleEntry } from './workflow-rule-condition.js'
import { isAllowedNormalStepKey, PASSTHROUGH_STEP_KEYS } from './workflow-shared-constants.js'

/**
 * Allowed step keys restored from `raw` when typed draft fields did not populate `out`.
 * Passthrough keys overlap is skipped in `mergeStepFieldsFromRaw` (see PASSTHROUGH_STEP_KEYS).
 */
const RAW_FALLBACK_STEP_KEYS = new Set(['instruction', 'policy', 'knowledge', 'output_contracts'])

function sectionMapToObject(
  kind: FacetKind,
  maps: SectionMap[],
): Record<string, string> | undefined {
  if (maps.length === 0) return undefined
  const out: Record<string, string> = {}
  for (const m of maps) {
    if (m.key) out[m.key] = facetManagedPath(kind, m.key)
  }
  return Object.keys(out).length ? out : undefined
}

function mergeStepFieldsFromRaw(out: Record<string, unknown>, step: StepDraft): void {
  for (const key of RAW_FALLBACK_STEP_KEYS) {
    if (key in out) continue
    const value = step.raw[key]
    if (value !== undefined) out[key] = value
  }
  for (const key of PASSTHROUGH_STEP_KEYS) {
    if (RAW_FALLBACK_STEP_KEYS.has(key)) continue
    const value = step.raw[key]
    if (value !== undefined) out[key] = value
  }
  for (const [k, v] of Object.entries(step.raw)) {
    if (!isAllowedNormalStepKey(k) && v !== undefined) out[k] = v
  }
}

function serializeNormalStep(step: StepDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { name: step.name }
  if (step.persona) out.persona = step.persona
  if (typeof step.edit === 'boolean') out.edit = step.edit
  if (step.permission) out.required_permission_mode = step.permission
  if (typeof step.passPrevious === 'boolean') out.pass_previous_response = step.passPrevious
  if (step.instruction) out.instruction = step.instruction
  if (step.provider) out.provider = step.provider
  if (step.model) out.model = step.model
  if (step.rules.length > 0) {
    out.rules = step.rules.map((r) => serializeRuleEntry(r))
  }
  mergeStepFieldsFromRaw(out, step)
  return out
}

export function serializeWorkflowDraft(draft: WorkflowDraft): string {
  const root: Record<string, unknown> = {}
  if (draft.name) root.name = draft.name
  if (draft.description) root.description = draft.description
  if (draft.initialStep) root.initial_step = draft.initialStep
  if (typeof draft.maxSteps === 'number') root.max_steps = draft.maxSteps

  const personas = sectionMapToObject('personas', draft.personas)
  if (personas) root.personas = personas
  const policies = sectionMapToObject('policies', draft.policies)
  if (policies) root.policies = policies
  const knowledge = sectionMapToObject('knowledge', draft.knowledge)
  if (knowledge) root.knowledge = knowledge
  const instructions = sectionMapToObject('instructions', draft.instructions)
  if (instructions) root.instructions = instructions
  const reportFormats = sectionMapToObject('reportFormats', draft.reportFormats)
  if (reportFormats) root.report_formats = reportFormats

  if (draft.workflowConfig !== undefined) root.workflow_config = draft.workflowConfig
  if (draft.loopMonitors !== undefined) root.loop_monitors = draft.loopMonitors
  if (draft.rateLimitFallback !== undefined) root.rate_limit_fallback = draft.rateLimitFallback
  if (draft.subworkflow !== undefined) root.subworkflow = draft.subworkflow

  root.steps = draft.steps.map((s) => (s.special ? s.raw : serializeNormalStep(s)))

  return YAML.stringify(root, { lineWidth: 0 })
}
