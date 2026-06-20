import type { PromptHistoryItem, WorkflowRunOverride, WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import type { PromptComposerRunDraft } from '../../lib/prompt-composer-run-draft.js'
import { useAppStore } from '../../store/app-store.js'
import { PromptComposer } from '../prompt-composer.js'

vi.mock('../../hooks/use-execution-option-sources.js', () => ({
  useExecutionOptionSources: () => ({
    engineConfig: null,
    catalog: null,
    workflowDefaults: undefined,
    workflowDefaultsUnavailable: false,
    loading: false,
    loadError: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('../composer-assist-panel', () => ({
  ComposerAssistPanel: () => <div>assist-panel-mock</div>,
}))

vi.mock('../workflow-selection/low-confidence-gate-dialog.js', () => ({
  LowConfidenceGateDialog: ({ onChoose }: { onChoose: (workflow: string) => void }) => (
    <button type="button" onClick={() => onChoose('minimal')}>
      choose-gated-workflow
    </button>
  ),
}))

vi.mock('../workflow-selection/workflow-selection-bar.js', () => ({
  WorkflowSelectionBar: ({
    runOverride,
    onRunOverrideChange,
    onWorkflowChange,
  }: {
    runOverride?: WorkflowRunOverride
    onRunOverrideChange?: (override: WorkflowRunOverride | undefined) => void
    onWorkflowChange: (workflow: string) => void
  }) => (
    <div>
      <p data-testid="run-override-state">{runOverride ? 'on' : 'off'}</p>
      <button
        type="button"
        onClick={() =>
          onRunOverrideChange?.({
            baseWorkflow: 'default',
            stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
          })
        }
      >
        set-run-override
      </button>
      <button type="button" onClick={() => onWorkflowChange('minimal')}>
        change-workflow
      </button>
    </div>
  ),
}))

const WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'project',
  stepNames: [],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

function renderComposer(props: Partial<ComponentProps<typeof PromptComposer>> = {}) {
  const onSubmit = vi.fn<(draft: PromptComposerRunDraft) => Promise<void>>(async () => {})
  const onDeleteHistory = vi.fn()
  const onWorkflowChange = vi.fn()
  render(
    <I18nProvider>
      <PromptComposer
        workflows={[WORKFLOW]}
        history={[]}
        selectedWorkflow="default"
        cliReady
        onWorkflowChange={onWorkflowChange}
        onSubmit={onSubmit}
        onDeleteHistory={onDeleteHistory}
        {...props}
      />
    </I18nProvider>,
  )
  return { onSubmit, onWorkflowChange }
}

function expectOverrideState(expected: 'on' | 'off') {
  expect(screen.getByTestId('run-override-state').textContent).toBe(expected)
}

function setRunOverride() {
  fireEvent.click(screen.getByRole('button', { name: 'set-run-override' }))
}

describe('PromptComposer workflow change clears runOverride', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ workflowMode: 'manual', uiLanguage: 'en' })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('clears runOverride when workflow changes via history apply', async () => {
    const historyItem: PromptHistoryItem = {
      id: 'h1',
      title: 'history draft',
      body: 'history body',
      workflow: 'review',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const { onWorkflowChange } = renderComposer({ history: [historyItem] })

    setRunOverride()
    expectOverrideState('on')

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(screen.getByRole('button', { name: 'history draft' }))

    expect(onWorkflowChange).toHaveBeenCalledWith('review')
    expectOverrideState('off')
  })

  it('clears runOverride when workflow is applied from assist handoff', async () => {
    const { onWorkflowChange } = renderComposer()

    setRunOverride()
    expectOverrideState('on')

    useAppStore.getState().setComposerAssistHandoff({
      sourceContext: '## Issue guilz-dev/planetz#777\nInvestigate and fix',
      workflow: 'review',
      issueRef: 'guilz-dev/planetz#777',
    })

    await waitFor(() => {
      expect(onWorkflowChange).toHaveBeenCalledWith('review')
    })
    expectOverrideState('off')
  })

  it('clears runOverride when gate picks a workflow', () => {
    const { onWorkflowChange } = renderComposer()

    setRunOverride()
    expectOverrideState('on')

    fireEvent.click(screen.getByRole('button', { name: 'choose-gated-workflow' }))

    expect(onWorkflowChange).toHaveBeenCalledWith('minimal')
    expectOverrideState('off')
  })
})
