import type { EnqueueTaskBridgeInput } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  buildWorkflowSelectionMeta,
  isRunOverrideAppliedToResolvedWorkflow,
} from '../session/workflow-selection/workflow-selection-enqueue.js'

function baseInput(overrides: Partial<EnqueueTaskBridgeInput> = {}): EnqueueTaskBridgeInput {
  return {
    title: 'Task',
    body: 'body',
    ...overrides,
  }
}

describe('isRunOverrideAppliedToResolvedWorkflow', () => {
  it('returns true when resolved workflow is a runtime override name', () => {
    expect(
      isRunOverrideAppliedToResolvedWorkflow(
        { baseWorkflow: 'default', stepOverrides: [{ stepName: 'implement', provider: 'cursor' }] },
        'default__modified-rt-a1b2c3d4',
      ),
    ).toBe(true)
  })

  it('returns false when override base does not match resolved workflow', () => {
    expect(
      isRunOverrideAppliedToResolvedWorkflow(
        { baseWorkflow: 'default', stepOverrides: [{ stepName: 'implement', provider: 'cursor' }] },
        'minimal',
      ),
    ).toBe(false)
  })
})

describe('buildWorkflowSelectionMeta', () => {
  it('returns auto meta for confirmed auto enqueue', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflowMode: 'auto',
        confirmedWorkflow: 'minimal',
      }),
      'minimal',
    )

    expect(meta).toEqual({
      kind: 'auto',
      baseWorkflow: 'minimal',
      resolvedWorkflow: 'minimal',
    })
  })

  it('returns auto meta when workflowSelectionKind is auto', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflowMode: 'auto',
        workflowSelectionKind: 'auto',
      }),
      'default',
      {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'high',
        score: 1,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
    )

    expect(meta?.kind).toBe('auto')
    expect(meta?.resolvedWorkflow).toBe('default')
  })

  it('returns auto meta when resolvedSelectionKind is auto', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({ workflowMode: 'auto' }),
      'minimal',
      undefined,
      'auto',
    )

    expect(meta).toEqual({
      kind: 'auto',
      baseWorkflow: 'minimal',
      resolvedWorkflow: 'minimal',
    })
  })

  it('returns modified meta only when runtime override was applied', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflow: 'default',
        runOverride: {
          baseWorkflow: 'default',
          stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
        },
      }),
      'default__modified-rt-a1b2c3d4',
    )

    expect(meta).toEqual({
      kind: 'modified',
      baseWorkflow: 'default',
      resolvedWorkflow: 'default__modified-rt-a1b2c3d4',
      runOverride: {
        baseWorkflow: 'default',
        stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
      },
    })
  })

  it('does not return modified meta when override was not materialized', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflow: 'minimal',
        workflowMode: 'auto',
        runOverride: {
          baseWorkflow: 'default',
          stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
        },
      }),
      'minimal',
    )

    expect(meta).toBeUndefined()
  })

  it('returns auto meta for confirmed enqueue with stale runOverride', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflowMode: 'auto',
        confirmedWorkflow: 'minimal',
        runOverride: {
          baseWorkflow: 'default',
          stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
        },
      }),
      'minimal',
    )

    expect(meta).toEqual({
      kind: 'auto',
      baseWorkflow: 'minimal',
      resolvedWorkflow: 'minimal',
    })
  })

  it('returns manual meta for manual workflow mode without selection kind', () => {
    const meta = buildWorkflowSelectionMeta(
      baseInput({
        workflow: 'default',
        workflowMode: 'manual',
      }),
      'default',
    )

    expect(meta).toEqual({
      kind: 'manual',
      baseWorkflow: 'default',
      resolvedWorkflow: 'default',
    })
  })
})
