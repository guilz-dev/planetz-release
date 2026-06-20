import type { WorkflowSummary } from '@planetz/shared'
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

describe('PromptComposer Auto mode', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
    resetAppStore()
    useAppStore.setState({ workflowMode: 'auto', lastAutoDecision: null, uiLanguage: 'en' })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows readonly placeholder when Auto is on and no decision yet', () => {
    renderComposer()
    expect(screen.getByText('Auto - Workflow chosen on submit')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /select workflow/i })).toBeNull()
  })

  it('shows manual workflow selector when Auto is off', () => {
    useAppStore.setState({ workflowMode: 'manual' })
    renderComposer()
    expect(screen.getByRole('button', { name: /select workflow/i })).toBeTruthy()
  })

  it('displays last auto decision workflow name in readonly combobox', () => {
    useAppStore.setState({
      lastAutoDecision: {
        selectedWorkflow: 'bugfix-flow',
        group: 'bugfix',
        confidence: 'high',
        score: 0.9,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
    })
    renderComposer()
    expect(screen.getByText('Auto decision')).toBeTruthy()
    expect(screen.getAllByText('bugfix-flow').length).toBeGreaterThanOrEqual(1)
  })

  it('submits without workflow when Auto is on', async () => {
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByPlaceholderText(/Describe what you'd like/), {
      target: { value: 'fix login bug' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enqueue/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const draft = onSubmit.mock.calls[0]?.[0] as PromptComposerRunDraft
    expect(draft.workflowMode).toBe('auto')
    expect(draft.workflow).toBeUndefined()
  })

  it('submits manual workflow when Auto is off', async () => {
    useAppStore.setState({ workflowMode: 'manual' })
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByPlaceholderText(/Describe what you'd like/), {
      target: { value: 'docs update' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enqueue/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const draft = onSubmit.mock.calls[0]?.[0] as PromptComposerRunDraft
    expect(draft.workflowMode).toBe('manual')
    expect(draft.workflow).toBe('default')
  })

  it('does not submit when input has only zero-width characters', () => {
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByPlaceholderText(/Describe what you'd like/), {
      target: { value: '\u200B\u200C\u200D\u2060\uFEFF' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enqueue/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
