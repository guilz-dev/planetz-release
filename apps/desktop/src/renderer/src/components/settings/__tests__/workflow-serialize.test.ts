import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import { hasRoundTripLoss, isYamlFormEditable } from '../workflow-form-safety.js'
import { parseWorkflowYaml } from '../workflow-parse.js'
import { serializeWorkflowDraft } from '../workflow-serialize.js'

describe('serializeWorkflowDraft', () => {
  it('round-trips default workflow without structural loss', () => {
    expect(hasRoundTripLoss(BUILTIN_DEFAULT_WORKFLOW_YAML)).toBe(false)
    expect(isYamlFormEditable(BUILTIN_DEFAULT_WORKFLOW_YAML)).toBe(true)
  })

  it('preserves ai() conditions', () => {
    const yaml = `name: ai-wf
steps:
  - name: review
    persona: reviewer
    rules:
      - condition: 'ai("Looks good")'
        next: COMPLETE
`
    const draft = parseWorkflowYaml(yaml)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('ai("Looks good")')
    expect(draft.steps[0].rules[0].mode).toBe('ai')
  })

  it('round-trips default workflow policy knowledge and output_contracts', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const out = serializeWorkflowDraft(draft)
    const reparsed = parseWorkflowYaml(out)
    expect(reparsed.personas.map((entry) => entry.key).sort()).toEqual([
      'coder',
      'planner',
      'qa-reviewer',
    ])
    expect(reparsed.steps[0].persona).toBe('planner')
    expect((reparsed.steps[0].raw as Record<string, unknown>).policy).toBe('coding')
    expect((reparsed.steps[0].raw as Record<string, unknown>).knowledge).toBe('architecture')
    expect(reparsed.steps[0].instruction).toBe('plan')
    expect(out).toContain('output_contracts:')
    expect(out).toContain('report:')
    expect(out).not.toContain('markdown:')
    expect(hasRoundTripLoss(BUILTIN_DEFAULT_WORKFLOW_YAML)).toBe(false)
  })

  it('preserves provider/model/output_contracts during round-trip', () => {
    const yaml = `name: model-wf
steps:
  - name: implement
    persona: coder
    provider: anthropic
    model: claude-4
    output_contracts:
      - name: report
        schema: report-v1
    rules:
      - condition: done
        next: COMPLETE
`
    const draft = parseWorkflowYaml(yaml)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('provider: anthropic')
    expect(out).toContain('model: claude-4')
    expect(out).toContain('output_contracts:')
    expect(hasRoundTripLoss(yaml)).toBe(false)
  })

  it('normalizes facet paths from keys on serialize', () => {
    const yaml = `name: facet-wf
personas:
  scope validator: ../custom/persona.md
steps:
  - name: plan
`
    const draft = parseWorkflowYaml(yaml)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('scope validator: ../facets/personas/scope-validator.md')
  })

  it('round-trips step provider_options.reasoning_effort for codex', () => {
    const yaml = `name: effort-wf
steps:
  - name: plan
    provider: codex
    model: gpt-5.2-codex
    provider_options:
      codex:
        reasoning_effort: medium
    rules:
      - condition: done
        next: COMPLETE
`
    const draft = parseWorkflowYaml(yaml)
    expect((draft.steps[0].raw as Record<string, unknown>).provider_options).toEqual({
      codex: { reasoning_effort: 'medium' },
    })
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('reasoning_effort: medium')
    expect(hasRoundTripLoss(yaml)).toBe(false)
  })

  it('round-trips step provider and model in serialized output', () => {
    const yaml = `${BUILTIN_DEFAULT_WORKFLOW_YAML.replace(
      'name: default',
      'name: provider-test',
    )}`.replace(
      '- name: implement',
      '- name: implement\n    provider: anthropic\n    model: claude-test',
    )
    const draft = parseWorkflowYaml(yaml)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('provider: anthropic')
    expect(out).toContain('model: claude-test')
  })
})
