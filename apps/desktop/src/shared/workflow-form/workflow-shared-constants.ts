import type { SpecialKind } from './workflow-draft-types.js'

export const SUPPORTED_TOP_KEYS = new Set([
  'name',
  'description',
  'initial_step',
  'max_steps',
  'personas',
  'policies',
  'knowledge',
  'instructions',
  'report_formats',
  'steps',
  'workflow_config',
  'loop_monitors',
  'rate_limit_fallback',
  'subworkflow',
])

export const SUPPORTED_STEP_KEYS = new Set([
  'name',
  'persona',
  'edit',
  'required_permission_mode',
  'pass_previous_response',
  'instruction',
  'policy',
  'knowledge',
  'rules',
  'output_contracts',
  'provider',
  'model',
  'provider_options',
])

/** Keys preserved via step.raw passthrough without blocking form mode. */
export const STEP_PASSTHROUGH_KEYS = new Set([
  'provider_options',
  'session',
  'promotion',
  'effects',
])

export const PASSTHROUGH_STEP_KEYS = [
  'provider',
  'model',
  'provider_options',
  'output_contracts',
  'policy',
  'knowledge',
  'session',
] as const

export const SPECIAL_STEP_KEYS: Array<[SpecialKind, string]> = [
  ['parallel', 'parallel'],
  ['arpeggio', 'arpeggio'],
  ['team_leader', 'team_leader'],
  ['workflow_call', 'workflow_call'],
]

export const RESERVED_STEP_NAMES = new Set(['COMPLETE', 'ABORT'])

export function isAllowedNormalStepKey(key: string): boolean {
  return SUPPORTED_STEP_KEYS.has(key) || STEP_PASSTHROUGH_KEYS.has(key)
}
