import type { SddOpenSnapshot, WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
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

vi.mock('../../hooks/use-workflow-routing-preview.js', () => ({
  useWorkflowRoutingPreview: () => ({
    routingPreview: { confirmedWorkflow: null },
    routingPreviewRef: { current: { confirmedWorkflow: null } },
    setConfirmedWorkflow: vi.fn(),
    onPreviewRoutingChange: vi.fn(),
    applyRouting: vi.fn(),
  }),
}))

vi.mock('../../hooks/use-workflow-enqueue-gate.js', () => ({
  useWorkflowEnqueueGate: () => ({
    open: false,
    gateDecision: null,
    closeGate: vi.fn(),
    setOpen: vi.fn(),
    prepareForEnqueue: vi.fn(async () => ({ proceed: true })),
  }),
}))

vi.mock('../../hooks/use-composer-execution-hint.js', () => ({
  useComposerExecutionHint: () => ({
    stepHint: null,
    ollamaGuard: null,
    ollamaGuardLoading: false,
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

const SPEC_STUDIO_SNAPSHOT: SddOpenSnapshot = {
  intentLedgerPendingCount: 0,
  intentLedgerUnanchoredCount: 0,
  kiroSpecCount: 1,
  featuresNeedingApproval: [],
  recommendedEntry: 'spec-studio',
  kiroPhase: 'requirements',
  specFeatureId: 'billing',
}

function renderComposer(props: Partial<ComponentProps<typeof PromptComposer>> = {}) {
  render(
    <I18nProvider>
      <PromptComposer
        workflows={[WORKFLOW]}
        history={[]}
        selectedWorkflow="default"
        onWorkflowChange={vi.fn()}
        onSubmit={vi.fn(async () => {})}
        onDeleteHistory={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  )
}

describe('PromptComposer spec studio guide', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ activeView: 'task' })
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('shows callout when guide conditions hold and banner is hidden', () => {
    renderComposer({
      sddOpen: SPEC_STUDIO_SNAPSHOT,
      workspacePath: '/tmp/ws',
      sddOpenBannerVisible: false,
    })

    expect(screen.getByText('Spec phase before implementation')).toBeTruthy()
  })

  it('hides callout when banner is visible', () => {
    renderComposer({
      sddOpen: SPEC_STUDIO_SNAPSHOT,
      workspacePath: '/tmp/ws',
      sddOpenBannerVisible: true,
    })

    expect(screen.queryByText('Spec phase before implementation')).toBeNull()
  })

  it('dismisses callout and persists to localStorage', () => {
    renderComposer({
      sddOpen: SPEC_STUDIO_SNAPSHOT,
      workspacePath: '/tmp/ws',
      sddOpenBannerVisible: false,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Spec phase before implementation')).toBeNull()
    expect(localStorage.getItem('planetz.specStudioFirstRunDismissed:/tmp/ws')).toBe('1')
  })
})
