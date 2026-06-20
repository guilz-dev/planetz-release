import type { RuleDraft, RuleMode, StepDraft, WorkflowDraft } from './workflow-draft-types.js'

/**
 * Common rule condition labels from takt docs and bundled builtins.
 * @see https://github.com/nrslib/takt/blob/main/docs/workflows.md#rules
 */
export const TAKT_COMMON_RULE_CONDITIONS: readonly string[] = [
  'Planning complete',
  'Analysis complete',
  'Implementation complete',
  'Approved',
  'Needs fix',
  'Cannot proceed',
  'Done',
  'Processing complete',
  'All parts completed',
  'Progress is being made',
  'No progress',
  'Failing test added',
  'Tests pass',
  'approved',
  'needs_fix',
] as const

function parseParallelSubStepRules(raw: unknown): RuleDraft[] {
  if (!Array.isArray(raw)) return []
  const rules: RuleDraft[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const stepObj = entry as Record<string, unknown>
    if (!Array.isArray(stepObj.rules)) continue
    for (const r of stepObj.rules as Array<Record<string, unknown>>) {
      const condition = typeof r.condition === 'string' ? r.condition.trim() : ''
      if (condition) rules.push({ id: '', mode: 'tag', text: condition, next: '' })
    }
  }
  return rules
}

/** Suggested condition strings for tag / all / any rule editors. */
export function collectRuleConditionSuggestions(
  draft: WorkflowDraft,
  step: StepDraft,
  mode: RuleMode,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    out.push(trimmed)
  }

  if (mode === 'all' || mode === 'any') {
    for (const r of parseParallelSubStepRules(step.raw.parallel)) {
      push(r.text)
    }
  } else {
    for (const r of step.rules) {
      if (r.mode === 'tag') push(r.text)
    }
  }

  for (const s of draft.steps) {
    for (const r of s.rules) {
      if (r.mode === 'tag') push(r.text)
    }
  }

  for (const label of TAKT_COMMON_RULE_CONDITIONS) {
    push(label)
  }

  return out
}

export const RULE_CONDITION_CUSTOM_OPTION = '__custom__'
