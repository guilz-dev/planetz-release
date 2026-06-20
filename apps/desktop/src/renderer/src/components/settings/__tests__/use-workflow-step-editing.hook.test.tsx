import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWorkflowStepEditing } from '../use-workflow-step-editing.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

const YAML = `name: steps-wf
initial_step: step-1
steps:
  - name: step-1
    rules: []
`

describe('useWorkflowStepEditing', () => {
  it('addStep appends a step and selects the new id', () => {
    const draft = parseWorkflowYaml(YAML)
    const setDraft = vi.fn()
    const setSelectedStepId = vi.fn()

    const { result } = renderHook(() =>
      useWorkflowStepEditing({
        draft,
        setDraft,
        selectedStepId: draft.steps[0].id,
        setSelectedStepId,
        requestConfirm: vi.fn(async () => true),
      }),
    )

    act(() => {
      result.current.addStep()
    })

    expect(setDraft).toHaveBeenCalledTimes(1)
    const next = setDraft.mock.calls[0][0]
    expect(next.steps).toHaveLength(2)
    expect(next.steps[1].name).toBe('step-2')
    expect(setSelectedStepId).toHaveBeenCalledWith(next.steps[1].id)
  })

  it('reorderStepById moves steps without changing count', () => {
    const base = parseWorkflowYaml(YAML)
    const secondId = 'step-2-id'
    const draft = {
      ...base,
      steps: [...base.steps, { id: secondId, name: 'step-2', rules: [], raw: {} }],
    }
    const setDraft = vi.fn()

    const { result } = renderHook(() =>
      useWorkflowStepEditing({
        draft,
        setDraft,
        selectedStepId: draft.steps[0].id,
        setSelectedStepId: vi.fn(),
        requestConfirm: vi.fn(async () => true),
      }),
    )

    act(() => {
      result.current.reorderStepById(draft.steps[0].id, secondId)
    })

    const next = setDraft.mock.calls[0][0]
    expect(next.steps.map((s: { name: string }) => s.name)).toEqual(['step-2', 'step-1'])
  })
})
