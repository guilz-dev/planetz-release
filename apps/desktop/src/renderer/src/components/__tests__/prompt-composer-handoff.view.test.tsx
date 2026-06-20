import type { WorkflowSummary } from '@planetz/shared'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
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

const WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'project',
  stepNames: [],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

function renderComposer(
  overrides: Partial<OrbitBridge> = {},
  props: Partial<ComponentProps<typeof PromptComposer>> = {},
) {
  installOrbitMock(overrides)
  const onSubmit = vi.fn<(draft: PromptComposerRunDraft) => Promise<void>>(async () => {})
  const onWorkflowChange = props.onWorkflowChange ?? vi.fn()
  render(
    <I18nProvider>
      <PromptComposer
        workflows={[WORKFLOW]}
        history={[]}
        selectedWorkflow="default"
        cliReady
        onWorkflowChange={onWorkflowChange}
        onSubmit={onSubmit}
        onDeleteHistory={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  )
  return { onSubmit, onWorkflowChange }
}

describe('PromptComposer composer assist handoff', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ uiLanguage: 'en', workflowMode: 'manual' })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('consumes a handoff: opens assist mode and starts a fresh session with the source context', async () => {
    const startComposerSession = vi.fn<OrbitBridge['startComposerSession']>(async () => ({
      sessionId: 'composer_test',
      question: '',
      recommendedAnswer: '',
      assistantMessage: 'Refined plan from the issue.',
      turnIndex: 1,
      readyToFinalize: true,
    }))
    const onWorkflowChange = vi.fn()
    useAppStore.getState().setComposerAssistHandoff({
      sourceContext: '## Issue guilz-dev/planetz#368\nFix it',
      workflow: 'review',
      issueRef: 'guilz-dev/planetz#368',
    })

    renderComposer({ startComposerSession }, { onWorkflowChange })

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'interactive-assistant',
          sourceContext: '## Issue guilz-dev/planetz#368\nFix it',
          forceNew: true,
        }),
      )
    })
    // Handoff is consumed exactly once.
    expect(useAppStore.getState().composerAssistHandoff).toBeNull()
    // Workflow from the handoff is applied.
    expect(onWorkflowChange).toHaveBeenCalledWith('review')
    // The reference note is shown and the assistant reply is rendered.
    expect(screen.getByText(/Referencing guilz-dev\/planetz#368/)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/Refined plan from the issue\./)).toBeTruthy()
    })
  })

  it('does not start an assist session without a handoff', async () => {
    const startComposerSession = vi.fn<OrbitBridge['startComposerSession']>()
    renderComposer({ startComposerSession })

    // Default composer renders the direct-input textarea, not the assist panel.
    expect(
      screen.getByPlaceholderText("Describe what you'd like the agent to take on…"),
    ).toBeTruthy()
    expect(startComposerSession).not.toHaveBeenCalled()
  })

  it('clears handoff source context after assist completion', async () => {
    const startComposerSession = vi.fn<OrbitBridge['startComposerSession']>(async () => ({
      sessionId: 'composer_test',
      question: '',
      recommendedAnswer: '',
      assistantMessage: 'Refined plan from the issue.',
      turnIndex: 1,
      readyToFinalize: true,
    }))
    const acceptComposerSession = vi.fn<OrbitBridge['acceptComposerSession']>(async () => ({
      sessionId: 'composer_test',
      body: 'Accepted assistant draft',
      allowedActions: ['save_task'],
    }))
    const getActiveComposerSession = vi.fn<OrbitBridge['getActiveComposerSession']>(
      async () => null,
    )
    useAppStore.getState().setComposerAssistHandoff({
      sourceContext: '## Issue guilz-dev/planetz#368\nFix it',
      workflow: 'review',
      issueRef: 'guilz-dev/planetz#368',
    })

    const { onSubmit } = renderComposer({
      startComposerSession,
      acceptComposerSession,
      getActiveComposerSession,
    })

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceContext: '## Issue guilz-dev/planetz#368\nFix it',
          forceNew: true,
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Use latest reply' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add to queue' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add to queue' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Refine' }))
    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalledTimes(2)
    })
    expect(startComposerSession.mock.calls[1]?.[0]).not.toHaveProperty('sourceContext')
  })

  it('consumes chat-to-task handoff into Add Task body once', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    useAppStore.getState().setChatToTaskHandoff({
      body: 'Investigate root cause and summarize findings.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    renderComposer({ recordChatToTaskMetric })

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Investigate root cause and summarize findings.'),
      ).toBeTruthy()
    })
    expect(useAppStore.getState().chatToTaskHandoff).toBeNull()
    expect(recordChatToTaskMetric).not.toHaveBeenCalled()
  })

  it('focuses Cancel when conflict dialog opens', async () => {
    renderComposer()

    const textarea = screen.getByPlaceholderText(
      "Describe what you'd like the agent to take on…",
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'Existing task draft.' },
    })

    useAppStore.getState().setChatToTaskHandoff({
      body: 'Incoming from chat.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    await waitFor(() => {
      expect(screen.getByText('Add Task body already has text')).toBeTruthy()
    })
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
      expect(document.activeElement).toBe(cancel)
    })
  })

  it('records replace metric when conflict dialog replaces body', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    renderComposer({ recordChatToTaskMetric })

    const textarea = screen.getByPlaceholderText(
      "Describe what you'd like the agent to take on…",
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Existing task draft.' } })

    useAppStore.getState().setChatToTaskHandoff({
      body: 'Incoming from chat.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    await waitFor(() => {
      expect(screen.getByText('Add Task body already has text')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Incoming from chat.')).toBeTruthy()
    })
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_conflict_replace' })
  })

  it('records apply_failed when handoff body is empty after normalization', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    useAppStore.getState().setChatToTaskHandoff({
      body: '   \n\t  ',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    renderComposer({ recordChatToTaskMetric })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Could not apply the copied Chat reply to Add Task. Check the draft and retry.',
        ),
      ).toBeTruthy()
    })
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_apply_failed' })
    expect(useAppStore.getState().chatToTaskHandoff).toEqual(
      expect.objectContaining({ body: '   \n\t  ' }),
    )
  })

  it('does not record apply_failed again when typing after apply failure', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    useAppStore.getState().setChatToTaskHandoff({
      body: '   \n\t  ',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    renderComposer({ recordChatToTaskMetric })

    await waitFor(() => {
      expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_apply_failed' })
    })
    recordChatToTaskMetric.mockClear()

    const textarea = screen.getByPlaceholderText(
      "Describe what you'd like the agent to take on…",
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'User typed while handoff is still held.' } })

    expect(recordChatToTaskMetric).not.toHaveBeenCalled()
  })

  it('records retry metric when re-queuing a held handoff', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    useAppStore.getState().setChatToTaskHandoff({
      body: '   \n\t  ',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    renderComposer({ recordChatToTaskMetric })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry handoff' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry handoff' }))
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_retry' })
  })

  it('asks replace or append when Add Task already has body text', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    renderComposer({ recordChatToTaskMetric })

    const textarea = screen.getByPlaceholderText(
      "Describe what you'd like the agent to take on…",
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'Existing task draft.' },
    })

    useAppStore.getState().setChatToTaskHandoff({
      body: 'Incoming from chat.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    await waitFor(() => {
      expect(screen.getByText('Add Task body already has text')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Append' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Existing task draft\.\s+Incoming from chat\./)).toBeTruthy()
    })
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_conflict_append' })
  })

  it('records cancel metric when conflict dialog is dismissed', async () => {
    const recordChatToTaskMetric = vi.fn<OrbitBridge['recordChatToTaskMetric']>(async () => {})
    renderComposer({ recordChatToTaskMetric })

    const textarea = screen.getByPlaceholderText(
      "Describe what you'd like the agent to take on…",
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Existing task draft.' } })

    useAppStore.getState().setChatToTaskHandoff({
      body: 'Incoming from chat.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
    })

    await waitFor(() => {
      expect(screen.getByText('Add Task body already has text')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_conflict_cancel' })
  })

  it('shows truncation notice when chat handoff payload is clipped', async () => {
    useAppStore.getState().setChatToTaskHandoff({
      body: 'Long content clipped for handoff.',
      sourceThreadId: 'thr_1',
      sourceTurnId: 'turn_a1',
      truncated: true,
    })

    renderComposer()

    await waitFor(() => {
      expect(
        screen.getByText(
          'The copied Chat reply was longer than the handoff limit and has been trimmed.',
        ),
      ).toBeTruthy()
    })
  })
})
