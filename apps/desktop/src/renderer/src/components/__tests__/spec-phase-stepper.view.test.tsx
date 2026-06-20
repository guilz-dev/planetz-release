import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpecPhaseStepper } from '../spec-studio/spec-phase-stepper'

const labels = {
  clarify: 'Pin down intent',
  decide: 'Lock in the spec',
  trace: 'Check implementation drift',
  stepNumbers: ['1', '2', '3'] as [string, string, string],
  traceDisabledHint: 'Available after implementation tasks are linked to this spec.',
}

describe('SpecPhaseStepper', () => {
  afterEach(() => {
    cleanup()
  })
  it('shows drift warning badge on trace step', () => {
    render(
      <SpecPhaseStepper
        workbenchPhase="decide"
        threadPhase="drift"
        taskCount={2}
        driftCount={3}
        labels={labels}
        onSelectPhase={vi.fn()}
      />,
    )

    expect(screen.getByText('⚠ 3')).toBeTruthy()
  })

  it('shows task count badge when tasks exist without drift', () => {
    render(
      <SpecPhaseStepper
        workbenchPhase="decide"
        threadPhase="implementing"
        taskCount={4}
        driftCount={0}
        labels={labels}
        onSelectPhase={vi.fn()}
      />,
    )

    const traceTab = screen.getAllByRole('tab')[2]
    expect(traceTab.textContent).toContain('4')
  })

  it('marks trace step muted with tooltip when no tasks are linked', () => {
    render(
      <SpecPhaseStepper
        workbenchPhase="clarify"
        threadPhase="clarify"
        taskCount={0}
        driftCount={0}
        labels={labels}
        onSelectPhase={vi.fn()}
      />,
    )

    const traceTab = screen.getAllByRole('tab')[2]
    expect(traceTab.getAttribute('title')).toBe(labels.traceDisabledHint)
  })

  it('still allows selecting trace when muted', () => {
    const onSelectPhase = vi.fn()
    render(
      <SpecPhaseStepper
        workbenchPhase="clarify"
        threadPhase="clarify"
        taskCount={0}
        driftCount={0}
        labels={labels}
        onSelectPhase={onSelectPhase}
      />,
    )

    fireEvent.click(screen.getAllByRole('tab')[2])
    expect(onSelectPhase).toHaveBeenCalledWith('trace')
  })
})
