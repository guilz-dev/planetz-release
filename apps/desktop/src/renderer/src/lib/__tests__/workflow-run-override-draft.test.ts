import { describe, expect, it } from 'vitest'
import {
  changeWorkflowStepExecutionProfile,
  hasRunOverrideChangesForDisplayWorkflow,
  normalizeRunOverrideForDisplayWorkflow,
} from '../workflow-run-override-draft.js'

describe('workflow-run-override-draft', () => {
  it('stores provider-only override', () => {
    const next = changeWorkflowStepExecutionProfile({
      displayWorkflow: 'minimal',
      stepName: 'implement',
      providerValue: 'cursor',
      modelValue: '',
    })
    expect(next).toEqual({
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
    })
  })

  it('stores provider and model override', () => {
    const next = changeWorkflowStepExecutionProfile({
      displayWorkflow: 'minimal',
      stepName: 'implement',
      providerValue: 'codex',
      modelValue: 'gpt-5.3-codex-high',
    })
    expect(next).toEqual({
      baseWorkflow: 'minimal',
      stepOverrides: [
        {
          stepName: 'implement',
          provider: 'codex',
          model: 'gpt-5.3-codex-high',
        },
      ],
    })
  })

  it('drops model when provider is empty', () => {
    const next = changeWorkflowStepExecutionProfile({
      displayWorkflow: 'minimal',
      stepName: 'implement',
      providerValue: '',
      modelValue: 'gpt-5.3-codex-high',
    })
    expect(next).toBeUndefined()
  })

  it('removes override when values match step defaults', () => {
    const next = changeWorkflowStepExecutionProfile({
      displayWorkflow: 'minimal',
      runOverride: {
        baseWorkflow: 'minimal',
        stepOverrides: [{ stepName: 'implement', provider: 'codex', model: 'gpt-5.3-codex-high' }],
      },
      stepName: 'implement',
      stepDefaultProvider: 'codex',
      stepDefaultModel: 'gpt-5.3-codex-high',
      providerValue: 'codex',
      modelValue: 'gpt-5.3-codex-high',
    })
    expect(next).toBeUndefined()
  })

  it('normalizes stale run override entries', () => {
    const staleRunOverride = {
      baseWorkflow: 'minimal',
      stepOverrides: [
        { stepName: 'review', skipped: true },
        { stepName: 'implement', model: 'gpt-5.3-codex-high' },
        { stepName: 'fix', provider: 'cursor', model: 'cursor-sonnet' },
      ],
    } as unknown
    const next = normalizeRunOverrideForDisplayWorkflow({
      displayWorkflow: 'minimal',
      runOverride: staleRunOverride as Parameters<
        typeof normalizeRunOverrideForDisplayWorkflow
      >[0]['runOverride'],
    })
    expect(next).toEqual({
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'fix', provider: 'cursor', model: 'cursor-sonnet' }],
    })
  })

  it('reports no changes for stale-only run override', () => {
    const staleRunOverride = {
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'review', skipped: true }],
    } as unknown
    expect(
      hasRunOverrideChangesForDisplayWorkflow({
        displayWorkflow: 'minimal',
        runOverride: staleRunOverride as Parameters<
          typeof hasRunOverrideChangesForDisplayWorkflow
        >[0]['runOverride'],
      }),
    ).toBe(false)
  })
})
