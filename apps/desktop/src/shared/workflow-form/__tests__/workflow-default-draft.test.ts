import { describe, expect, it } from 'vitest'
import { hasRoundTripLoss } from '../workflow-form-safety.js'
import { parseWorkflowYaml } from '../workflow-parse.js'
import { workflowFormMode, workflowSummaryFormFields } from '../workflow-readonly.js'
import { ruleReturnValue, ruleUsesReturn, serializeRuleEntry } from '../workflow-rule-condition.js'
import { serializeWorkflowDraft } from '../workflow-serialize.js'
import { DEFAULT_DRAFT_MINIMAL_YAML } from './workflow-form-fixtures.js'

describe('default-draft form mode (Phase 1)', () => {
  it('parses without unsupported keys', () => {
    const draft = parseWorkflowYaml(DEFAULT_DRAFT_MINIMAL_YAML)
    expect(draft.unsupportedKeys).toEqual([])
    expect(draft.steps.every((s) => !s.special)).toBe(true)
  })

  it('is full form mode without round-trip loss', () => {
    const draft = parseWorkflowYaml(DEFAULT_DRAFT_MINIMAL_YAML)
    expect(workflowFormMode(draft, DEFAULT_DRAFT_MINIMAL_YAML)).toBe('full')
    expect(hasRoundTripLoss(DEFAULT_DRAFT_MINIMAL_YAML)).toBe(false)
  })

  it('exposes catalog form fields as form-editable (not yaml-only)', () => {
    const fields = workflowSummaryFormFields(DEFAULT_DRAFT_MINIMAL_YAML)
    expect(fields.formMode).toBe('full')
    expect(fields.formEditable).toBe(true)
  })

  it('preserves $param instruction, array policy/knowledge, and return rules on serialize', () => {
    const draft = parseWorkflowYaml(DEFAULT_DRAFT_MINIMAL_YAML)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('$param: impl_instruction')
    expect(out).toContain('- coding')
    expect(out).toContain('return: need_replan')
    expect(out).toContain('requires_user_input: true')
    expect(out).toContain('interactive_only: true')
    expect(out).toContain('output_contracts:')
    expect(out).toContain('coder-scope')
    expect(out).toContain('callable: true')
    expect(hasRoundTripLoss(out)).toBe(false)
  })

  it('detects return-only rules', () => {
    const draft = parseWorkflowYaml(DEFAULT_DRAFT_MINIMAL_YAML)
    const implement = draft.steps.find((s) => s.name === 'implement')
    const returnRule = implement?.rules.find((r) => ruleUsesReturn(r))
    if (!returnRule) throw new Error('expected return rule on implement step')
    expect(ruleReturnValue(returnRule)).toBe('need_replan')
    const serialized = serializeRuleEntry(returnRule)
    expect(serialized.return).toBe('need_replan')
    expect(serialized.next).toBeUndefined()
  })
})
