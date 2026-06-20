import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import { isFormSafe } from '../workflow-form-safety.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

describe('parseWorkflowYaml', () => {
  it('parses default builtin workflow as form-safe', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    expect(isFormSafe(draft)).toBe(true)
    expect(draft.steps).toHaveLength(4)
    expect(draft.steps[0].rules[0].mode).toBe('tag')
  })

  it('parses advanced top-level keys as form-safe', () => {
    const draft = parseWorkflowYaml(
      `${BUILTIN_DEFAULT_WORKFLOW_YAML}loop_monitors: []\nrate_limit_fallback:\n  switch_chain: []\n`,
    )
    expect(draft.unsupportedKeys).not.toContain('loop_monitors')
    expect(draft.loopMonitors).toEqual([])
    expect(draft.rateLimitFallback).toEqual({ switch_chain: [] })
    expect(isFormSafe(draft)).toBe(true)
  })

  it('round-trips step provider and model', () => {
    const yaml = `${BUILTIN_DEFAULT_WORKFLOW_YAML.replace(
      'name: default',
      'name: provider-test',
    )}`.replace(
      '- name: implement',
      '- name: implement\n    provider: anthropic\n    model: claude-test',
    )
    const draft = parseWorkflowYaml(yaml)
    const implement = draft.steps.find((s) => s.name === 'implement')
    expect(implement?.provider).toBe('anthropic')
    expect(implement?.model).toBe('claude-test')
  })

  it('flags parallel steps as special', () => {
    const yaml = `name: parallel-wf
steps:
  - name: review
    parallel:
      - name: a
        persona: reviewer
`
    const draft = parseWorkflowYaml(yaml)
    expect(draft.steps[0].special).toBe('parallel')
    expect(isFormSafe(draft)).toBe(false)
  })
})
