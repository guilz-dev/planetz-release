import YAML from 'yaml'
import type {
  RuleDraft,
  SectionMap,
  SpecialKind,
  StepDraft,
  WorkflowDraft,
} from './workflow-draft-types.js'
import { detectRuleMode } from './workflow-rule-condition.js'
import {
  isAllowedNormalStepKey,
  SPECIAL_STEP_KEYS,
  SUPPORTED_TOP_KEYS,
} from './workflow-shared-constants.js'

let _id = 0
function uid(prefix: string): string {
  _id += 1
  return `${prefix}-${_id}`
}

function toSectionMap(obj: unknown): SectionMap[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj as Record<string, unknown>).map(([key, value]) => ({
    key,
    path: typeof value === 'string' ? value : '',
    content: '',
  }))
}

function detectSpecial(stepObj: Record<string, unknown>): SpecialKind | undefined {
  for (const [kind, key] of SPECIAL_STEP_KEYS) {
    if (key in stepObj) return kind
  }
  if (stepObj.kind === 'workflow_call') return 'workflow_call'
  // Legacy orbit steps: `call:` without `kind: workflow_call`.
  if (typeof stepObj.call === 'string' && stepObj.call.length > 0) return 'workflow_call'
  return undefined
}

export function parseWorkflowYaml(yaml: string): WorkflowDraft {
  try {
    const root = (YAML.parse(yaml) ?? {}) as Record<string, unknown>
    const unsupportedKeys: string[] = []
    for (const k of Object.keys(root)) {
      if (!SUPPORTED_TOP_KEYS.has(k)) unsupportedKeys.push(k)
    }

    const steps: StepDraft[] = []
    const rawSteps = Array.isArray(root.steps) ? (root.steps as Array<Record<string, unknown>>) : []
    for (const stepObj of rawSteps) {
      const special = detectSpecial(stepObj)
      if (!special) {
        for (const k of Object.keys(stepObj)) {
          if (!isAllowedNormalStepKey(k)) unsupportedKeys.push(`steps[].${k}`)
        }
      }
      const rules: RuleDraft[] = Array.isArray(stepObj.rules)
        ? (stepObj.rules as Array<Record<string, unknown>>).map((r) => {
            const condition = typeof r.condition === 'string' ? r.condition : ''
            const { mode, text } = detectRuleMode(condition)
            return {
              id: uid('rule'),
              mode,
              text,
              next: typeof r.next === 'string' ? r.next : '',
              return: typeof r.return === 'string' ? r.return : undefined,
              appendix: typeof r.appendix === 'string' ? r.appendix : undefined,
              raw: { ...r },
            }
          })
        : []
      steps.push({
        id: uid('step'),
        name: typeof stepObj.name === 'string' ? stepObj.name : '',
        provider: typeof stepObj.provider === 'string' ? stepObj.provider : undefined,
        model: typeof stepObj.model === 'string' ? stepObj.model : undefined,
        persona: typeof stepObj.persona === 'string' ? stepObj.persona : undefined,
        edit: typeof stepObj.edit === 'boolean' ? stepObj.edit : undefined,
        permission:
          stepObj.required_permission_mode === 'readonly' ||
          stepObj.required_permission_mode === 'edit' ||
          stepObj.required_permission_mode === 'full'
            ? stepObj.required_permission_mode
            : undefined,
        passPrevious:
          typeof stepObj.pass_previous_response === 'boolean'
            ? stepObj.pass_previous_response
            : undefined,
        instruction: typeof stepObj.instruction === 'string' ? stepObj.instruction : undefined,
        rules,
        special,
        raw: stepObj,
      })
    }

    return {
      name: typeof root.name === 'string' ? root.name : '',
      description: typeof root.description === 'string' ? root.description : undefined,
      initialStep: typeof root.initial_step === 'string' ? root.initial_step : undefined,
      maxSteps: typeof root.max_steps === 'number' ? root.max_steps : undefined,
      personas: toSectionMap(root.personas),
      policies: toSectionMap(root.policies),
      knowledge: toSectionMap(root.knowledge),
      instructions: toSectionMap(root.instructions),
      reportFormats: toSectionMap(root.report_formats),
      steps,
      workflowConfig: root.workflow_config,
      loopMonitors: root.loop_monitors,
      rateLimitFallback: root.rate_limit_fallback,
      subworkflow: root.subworkflow,
      unsupportedKeys,
    }
  } catch (err) {
    return {
      name: '',
      personas: [],
      policies: [],
      knowledge: [],
      instructions: [],
      reportFormats: [],
      steps: [],
      unsupportedKeys: [],
      parseError: err instanceof Error ? err.message : String(err),
    }
  }
}
