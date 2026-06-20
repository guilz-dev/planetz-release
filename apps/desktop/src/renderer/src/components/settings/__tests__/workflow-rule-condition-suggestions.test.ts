import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import { parseWorkflowYaml } from '../workflow-parse.js'
import {
  collectRuleConditionSuggestions,
  TAKT_COMMON_RULE_CONDITIONS,
} from '../workflow-rule-condition-suggestions.js'

describe('collectRuleConditionSuggestions', () => {
  it('includes builtin default conditions and common takt labels', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const plan = draft.steps.find((s) => s.name === 'plan')
    if (!plan) throw new Error('expected plan step')
    const suggestions = collectRuleConditionSuggestions(draft, plan, 'tag')
    expect(suggestions).toContain('Requirements are clear and implementable')
    expect(suggestions).toContain('Cannot proceed')
    expect(suggestions).toContain('Implementation complete')
    for (const label of TAKT_COMMON_RULE_CONDITIONS) {
      expect(suggestions).toContain(label)
    }
  })

  it('collects parallel sub-step conditions for aggregator modes', () => {
    const draft = parseWorkflowYaml(`name: parallel-wf
steps:
  - name: reviewers
    parallel:
      - name: arch
        rules:
          - condition: approved
          - condition: needs_fix
    rules:
      - condition: all("approved")
        next: COMPLETE
`)
    const step = draft.steps[0]
    const suggestions = collectRuleConditionSuggestions(draft, step, 'all')
    expect(suggestions.indexOf('approved')).toBeLessThan(suggestions.indexOf('Planning complete'))
  })
})
