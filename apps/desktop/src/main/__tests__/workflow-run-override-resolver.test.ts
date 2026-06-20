import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  applyWorkflowRunOverride,
  resolvedWorkflowNameForOverride,
} from '../session/workflow-selection/workflow-run-override-resolver.js'

const BASE_WORKFLOW_YAML = `
name: sample
steps:
  - name: implement
    provider: codex
    model: gpt-5.3-codex-high
    instruction: |
      implement task
    rules:
      - condition: done
        next: COMPLETE
`

describe('workflow-run-override-resolver', () => {
  it('applies provider and model override to a step', () => {
    const nextYaml = applyWorkflowRunOverride(BASE_WORKFLOW_YAML, {
      baseWorkflow: 'sample',
      stepOverrides: [
        {
          stepName: 'implement',
          provider: 'cursor',
          model: 'cursor-sonnet',
        },
      ],
    })
    const parsed = parseYaml(nextYaml) as {
      steps?: Array<{ provider?: string; model?: string }>
    }
    expect(parsed.steps?.[0]?.provider).toBe('cursor')
    expect(parsed.steps?.[0]?.model).toBe('cursor-sonnet')
  })

  it('clears model when provider-only override is set', () => {
    const nextYaml = applyWorkflowRunOverride(BASE_WORKFLOW_YAML, {
      baseWorkflow: 'sample',
      stepOverrides: [
        {
          stepName: 'implement',
          provider: 'cursor',
        },
      ],
    })
    const parsed = parseYaml(nextYaml) as {
      steps?: Array<{ provider?: string; model?: string }>
    }
    expect(parsed.steps?.[0]?.provider).toBe('cursor')
    expect(parsed.steps?.[0]?.model).toBeUndefined()
  })

  it('rejects model-only step overrides', () => {
    expect(() =>
      applyWorkflowRunOverride(BASE_WORKFLOW_YAML, {
        baseWorkflow: 'sample',
        stepOverrides: [
          {
            stepName: 'implement',
            model: 'cursor-sonnet',
          },
        ],
      }),
    ).toThrow(/requires provider/i)
  })

  it('marks override workflow name only when provider/model changes exist', () => {
    expect(
      resolvedWorkflowNameForOverride('sample', {
        baseWorkflow: 'sample',
        stepOverrides: [],
      }),
    ).toBe('sample')
    expect(
      resolvedWorkflowNameForOverride('sample', {
        baseWorkflow: 'sample',
        stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
      }),
    ).toMatch(/^sample__modified-rt-[0-9a-f]{8}$/)
  })

  it('uses the same runtime workflow name for semantically identical overrides', () => {
    const first = resolvedWorkflowNameForOverride('sample', {
      baseWorkflow: 'sample',
      stepOverrides: [
        { stepName: 'review', provider: 'cursor', model: 'model-a' },
        { stepName: 'implement', provider: 'cursor' },
      ],
    })
    const second = resolvedWorkflowNameForOverride('sample', {
      baseWorkflow: 'sample',
      stepOverrides: [
        { stepName: 'implement', provider: 'cursor' },
        { stepName: ' review ', provider: ' cursor ', model: ' model-a ' },
      ],
    })
    expect(first).toBe(second)
  })

  it('uses distinct runtime names for different override signatures', () => {
    const opus = resolvedWorkflowNameForOverride('sample', {
      baseWorkflow: 'sample',
      stepOverrides: [{ stepName: 'implement', provider: 'cursor', model: 'opus' }],
    })
    const sonnet = resolvedWorkflowNameForOverride('sample', {
      baseWorkflow: 'sample',
      stepOverrides: [{ stepName: 'implement', provider: 'cursor', model: 'sonnet' }],
    })
    expect(opus).not.toBe(sonnet)
    expect(opus).toMatch(/^sample__modified-rt-[0-9a-f]{8}$/)
    expect(sonnet).toMatch(/^sample__modified-rt-[0-9a-f]{8}$/)
  })
})
