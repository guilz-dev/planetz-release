import type { RuleDraft, RuleMode } from './workflow-draft-types.js'

export type { RuleMode }

export function detectRuleMode(condition: string): { mode: RuleMode; text: string } {
  const trimmed = condition.trim()
  const ai = trimmed.match(/^ai\((["'])(.*)\1\)$/s)
  if (ai) return { mode: 'ai', text: ai[2] }
  const all = trimmed.match(/^all\((["'])(.*)\1\)$/s)
  if (all) return { mode: 'all', text: all[2] }
  const any = trimmed.match(/^any\((["'])(.*)\1\)$/s)
  if (any) return { mode: 'any', text: any[2] }
  return { mode: 'tag', text: trimmed }
}

export function ruleToCondition(rule: RuleDraft): string {
  switch (rule.mode) {
    case 'ai':
      return `ai(${JSON.stringify(rule.text)})`
    case 'all':
      return `all(${JSON.stringify(rule.text)})`
    case 'any':
      return `any(${JSON.stringify(rule.text)})`
    default:
      return rule.text
  }
}

/** Resolved subworkflow return name for a rule (`return` field or legacy raw). */
export function ruleReturnValue(rule: RuleDraft): string | undefined {
  if (typeof rule.return === 'string' && rule.return.length > 0) return rule.return
  const rawReturn = rule.raw?.return
  if (typeof rawReturn === 'string' && rawReturn.length > 0) return rawReturn
  return undefined
}

export function ruleUsesReturn(rule: RuleDraft): boolean {
  return ruleReturnValue(rule) != null
}

export function subworkflowReturnNames(subworkflow: unknown): string[] {
  if (!subworkflow || typeof subworkflow !== 'object') return []
  const returns = (subworkflow as { returns?: unknown }).returns
  if (!Array.isArray(returns)) return []
  return returns.filter((name): name is string => typeof name === 'string' && name.length > 0)
}

export function patchRuleTransition(
  rule: RuleDraft,
  transition: 'next' | 'return',
  value: string,
): RuleDraft {
  const raw: Record<string, unknown> = { ...(rule.raw ?? {}) }
  if (transition === 'return') {
    raw.return = value
    delete raw.next
    const next = { ...rule, return: value, next: '', raw }
    raw.condition = ruleToCondition(next)
    return next
  }
  raw.next = value
  delete raw.return
  const next = { ...rule, next: value, return: undefined, raw }
  raw.condition = ruleToCondition(next)
  return next
}

/** Update condition / appendix while keeping `raw` aligned for round-trip extras. */
export function patchRuleFields(
  rule: RuleDraft,
  patch: Partial<Pick<RuleDraft, 'mode' | 'text' | 'appendix'>>,
): RuleDraft {
  const next: RuleDraft = { ...rule, ...patch }
  const raw: Record<string, unknown> = { ...(rule.raw ?? {}) }
  raw.condition = ruleToCondition(next)
  if (patch.appendix !== undefined) {
    if (patch.appendix) raw.appendix = patch.appendix
    else delete raw.appendix
  }
  return { ...next, raw }
}

export function serializeRuleEntry(rule: RuleDraft): Record<string, unknown> {
  const entry: Record<string, unknown> = rule.raw ? { ...rule.raw } : {}
  entry.condition = ruleToCondition(rule)
  const ret = ruleReturnValue(rule)
  if (ret) {
    entry.return = ret
    delete entry.next
  } else {
    if (rule.next) entry.next = rule.next
    else delete entry.next
    delete entry.return
  }
  if (rule.appendix) entry.appendix = rule.appendix
  else if ('appendix' in entry && rule.appendix === undefined) delete entry.appendix
  return entry
}
