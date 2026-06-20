import { describe, expect, it, vi } from 'vitest'
import { workflowChangeClearingRunOverride } from '../workflow-change-clearing-run-override.js'

describe('workflowChangeClearingRunOverride', () => {
  it('clears runOverride before updating selected workflow', () => {
    const order: string[] = []
    const setRunOverride = vi.fn(() => {
      order.push('override')
    })
    const setSelectedWorkflow = vi.fn(() => {
      order.push('workflow')
    })

    workflowChangeClearingRunOverride('minimal', setRunOverride, setSelectedWorkflow)

    expect(setRunOverride).toHaveBeenCalledWith(undefined)
    expect(setSelectedWorkflow).toHaveBeenCalledWith('minimal')
    expect(order).toEqual(['override', 'workflow'])
  })
})
