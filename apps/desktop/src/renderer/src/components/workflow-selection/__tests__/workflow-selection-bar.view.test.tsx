import type { WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { WorkflowSelectionBar } from '../workflow-selection-bar.js'

const mockEnableWorkflowForAuto = vi.fn(async () => {})

type MockAutoPreviewState = {
  loading: boolean
  decision: null
  libraryAutoSuggestion: {
    workflowName: string
    score: number
    displayName?: string
  } | null
  previewToken: string | null
  promptHash: string | null
  requestFullPreview: () => Promise<unknown>
}

const defaultMockAutoPreview = (): MockAutoPreviewState => ({
  loading: false,
  decision: null,
  libraryAutoSuggestion: null,
  previewToken: null,
  promptHash: null,
  requestFullPreview: vi.fn(async () => {}),
})

const mockUseWorkflowAutoPreview = vi.fn(defaultMockAutoPreview)

vi.mock('../../../hooks/use-workflow-auto-preview.js', () => ({
  useWorkflowAutoPreview: () => mockUseWorkflowAutoPreview(),
}))

vi.mock('../../../hooks/use-workflow-library-prefs.js', () => ({
  useWorkflowLibraryPrefs: () => ({
    prefs: null,
    enableWorkflowForAuto: mockEnableWorkflowForAuto,
  }),
}))

vi.mock('../../composer-workflow-auto.js', () => ({
  AutoToggle: ({
    onChange,
    ariaLabel,
  }: {
    onChange: (next: boolean) => void
    ariaLabel: string
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={() => onChange(true)}>
      toggle-auto
    </button>
  ),
}))

vi.mock('../workflow-auto-chip.js', () => ({
  WorkflowAutoChip: ({ onConfirmWorkflow }: { onConfirmWorkflow: (workflow: string) => void }) => (
    <button type="button" onClick={() => onConfirmWorkflow('minimal')}>
      confirm-auto-workflow
    </button>
  ),
}))

vi.mock('../workflow-picker-modal.js', () => ({
  WorkflowPickerModal: () => null,
}))

const WORKFLOWS: WorkflowSummary[] = [
  {
    name: 'default',
    source: 'project',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  },
]

describe('WorkflowSelectionBar runOverride clearing', () => {
  afterEach(() => {
    cleanup()
    mockEnableWorkflowForAuto.mockClear()
    mockUseWorkflowAutoPreview.mockReset()
    mockUseWorkflowAutoPreview.mockImplementation(defaultMockAutoPreview)
  })

  it('clears runOverride when confirming an auto decision', () => {
    const onRunOverrideChange = vi.fn()
    const onWorkflowChange = vi.fn()
    const onWorkflowModeChange = vi.fn()
    const onConfirmedWorkflowChange = vi.fn()

    render(
      <I18nProvider>
        <WorkflowSelectionBar
          workflows={WORKFLOWS}
          selectedWorkflow="default"
          onWorkflowChange={onWorkflowChange}
          workflowMode="auto"
          onWorkflowModeChange={onWorkflowModeChange}
          runOverride={{
            baseWorkflow: 'default',
            stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
          }}
          onRunOverrideChange={onRunOverrideChange}
          onConfirmedWorkflowChange={onConfirmedWorkflowChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'confirm-auto-workflow' }))

    expect(onConfirmedWorkflowChange).toHaveBeenCalledWith('minimal')
    expect(onWorkflowModeChange).toHaveBeenCalledWith('manual')
    expect(onWorkflowChange).toHaveBeenCalledWith('minimal')
    expect(onRunOverrideChange).toHaveBeenCalledWith(undefined)
  })

  it('clears runOverride when toggling auto mode', () => {
    const onRunOverrideChange = vi.fn()
    const onWorkflowModeChange = vi.fn()
    const onConfirmedWorkflowChange = vi.fn()

    render(
      <I18nProvider>
        <WorkflowSelectionBar
          workflows={WORKFLOWS}
          selectedWorkflow="default"
          onWorkflowChange={vi.fn()}
          workflowMode="manual"
          onWorkflowModeChange={onWorkflowModeChange}
          runOverride={{
            baseWorkflow: 'default',
            stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
          }}
          onRunOverrideChange={onRunOverrideChange}
          onConfirmedWorkflowChange={onConfirmedWorkflowChange}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Auto workflow selection' }))

    expect(onConfirmedWorkflowChange).toHaveBeenCalledWith(undefined)
    expect(onWorkflowModeChange).toHaveBeenCalledWith('auto')
    expect(onRunOverrideChange).toHaveBeenCalledWith(undefined)
  })
})

describe('WorkflowSelectionBar library auto suggestion', () => {
  afterEach(() => {
    cleanup()
    mockEnableWorkflowForAuto.mockClear()
    mockUseWorkflowAutoPreview.mockReset()
    mockUseWorkflowAutoPreview.mockImplementation(defaultMockAutoPreview)
  })

  it('enables auto for the suggested workflow and dismisses the banner', async () => {
    mockUseWorkflowAutoPreview.mockReturnValue({
      loading: false,
      decision: null,
      libraryAutoSuggestion: {
        workflowName: 'terraform',
        score: 0.42,
        displayName: 'Terraform',
      },
      previewToken: 'token',
      promptHash: 'hash-terraform',
      requestFullPreview: vi.fn(async () => {}),
    })

    render(
      <I18nProvider>
        <WorkflowSelectionBar
          workflows={WORKFLOWS}
          selectedWorkflow="default"
          onWorkflowChange={vi.fn()}
          workflowMode="auto"
          onWorkflowModeChange={vi.fn()}
          promptBody="provision terraform stack"
        />
      </I18nProvider>,
    )

    expect(screen.getByText(/Terraform looks like a better fit/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add to auto' }))
    expect(mockEnableWorkflowForAuto).toHaveBeenCalledWith('terraform')
    await waitFor(() => {
      expect(screen.queryByText(/Terraform looks like a better fit/i)).toBeNull()
    })
  })
})
