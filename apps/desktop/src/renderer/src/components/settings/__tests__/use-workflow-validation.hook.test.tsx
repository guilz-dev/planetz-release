import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../../__tests__/orbit-mock.js'
import {
  useWorkflowValidation,
  WORKFLOW_VALIDATION_DEBOUNCE_MS,
} from '../use-workflow-validation.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

const YAML = `name: doctor-wf
initial_step: step-1
steps:
  - name: step-1
    rules: []
`

describe('useWorkflowValidation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('runValidate stores doctor errors and sets hasDoctorError', async () => {
    const validateWorkflow = vi.fn(async () => [
      {
        level: 'error' as const,
        message: 'initial_step missing',
        path: 'initial_step',
      },
    ])
    installOrbitMock({ validateWorkflow })

    const draft = parseWorkflowYaml(YAML)
    const { result } = renderHook(() =>
      useWorkflowValidation({
        view: 'editor',
        draft,
        selected: 'doctor-wf',
        currentYaml: YAML,
      }),
    )

    await act(async () => {
      await result.current.runValidate()
    })

    await waitFor(() => {
      expect(result.current.hasDoctorError).toBe(true)
    })
    expect(validateWorkflow).toHaveBeenCalledWith({
      nameOrPath: 'doctor-wf',
      yaml: YAML,
    })
    expect(result.current.diagnostics).toHaveLength(1)
  })

  describe('debounced validate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls validateWorkflow after debounce when editor draft changes', async () => {
      const validateWorkflow = vi.fn(async () => [])
      installOrbitMock({ validateWorkflow })

      const draft = parseWorkflowYaml(YAML)
      const { rerender } = renderHook(
        ({ yaml }: { yaml: string }) =>
          useWorkflowValidation({
            view: 'editor',
            draft,
            selected: 'doctor-wf',
            currentYaml: yaml,
          }),
        { initialProps: { yaml: YAML } },
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(WORKFLOW_VALIDATION_DEBOUNCE_MS)
      })
      expect(validateWorkflow).toHaveBeenCalledTimes(1)

      rerender({ yaml: `${YAML}# edited` })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(WORKFLOW_VALIDATION_DEBOUNCE_MS - 1)
      })
      expect(validateWorkflow).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(validateWorkflow).toHaveBeenCalledTimes(2)
    })
  })
})
