import { describe, expect, it } from 'vitest'
import { hasRoundTripLoss } from '../workflow-form-safety.js'
import { parseWorkflowYaml } from '../workflow-parse.js'
import {
  patchRuleFields,
  patchRuleTransition,
  ruleReturnValue,
  ruleUsesReturn,
  serializeRuleEntry,
} from '../workflow-rule-condition.js'
import { serializeWorkflowDraft } from '../workflow-serialize.js'
import { BUILTIN_DEFAULT_MINIMAL_YAML } from './workflow-form-fixtures.js'

describe('patchRuleTransition', () => {
  it('clears return when switching to next', () => {
    const rule = {
      id: 'r1',
      mode: 'tag' as const,
      text: 'ok',
      next: '',
      return: 'need_replan',
      raw: { condition: 'ok', return: 'need_replan' },
    }
    const next = patchRuleTransition(rule, 'next', 'COMPLETE')
    expect(ruleUsesReturn(next)).toBe(false)
    expect(next.next).toBe('COMPLETE')
    const serialized = serializeRuleEntry(next)
    expect(serialized.return).toBeUndefined()
    expect(serialized.next).toBe('COMPLETE')
  })

  it('clears next when switching to return', () => {
    const rule = {
      id: 'r1',
      mode: 'tag' as const,
      text: 'ok',
      next: 'review',
      raw: { condition: 'ok', next: 'review' },
    }
    const next = patchRuleTransition(rule, 'return', 'need_replan')
    expect(ruleReturnValue(next)).toBe('need_replan')
    const serialized = serializeRuleEntry(next)
    expect(serialized.return).toBe('need_replan')
    expect(serialized.next).toBeUndefined()
  })
})

describe('patchRuleFields', () => {
  it('updates raw.condition when text changes', () => {
    const rule = {
      id: 'r1',
      mode: 'tag' as const,
      text: 'old',
      next: 'COMPLETE',
      raw: { condition: 'old', next: 'COMPLETE', requires_user_input: true },
    }
    const next = patchRuleFields(rule, { text: 'new label' })
    expect(next.raw?.condition).toBe('new label')
    expect(next.raw?.requires_user_input).toBe(true)
    const serialized = serializeRuleEntry(next)
    expect(serialized.condition).toBe('new label')
    expect(serialized.requires_user_input).toBe(true)
  })
})

describe('instruction $param round-trip', () => {
  it('preserves object instruction without other step fields', () => {
    const yaml = `name: param-only
steps:
  - name: plan
    instruction:
      $param: impl_instruction
    rules:
      - condition: ok
        next: COMPLETE
`
    expect(hasRoundTripLoss(yaml)).toBe(false)
    const draft = parseWorkflowYaml(yaml)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('$param: impl_instruction')
  })
})

describe('serializeRuleEntry', () => {
  it('omits empty next when rule has no transition target', () => {
    const rule = {
      id: 'r1',
      mode: 'tag' as const,
      text: 'done',
      next: '',
      raw: { condition: 'done' },
    }
    const serialized = serializeRuleEntry(rule)
    expect(serialized.next).toBeUndefined()
    expect(serialized.condition).toBe('done')
  })
})

describe('default workflow regression', () => {
  it('still round-trips builtin default minimal', () => {
    expect(hasRoundTripLoss(BUILTIN_DEFAULT_MINIMAL_YAML)).toBe(false)
  })
})
