import type { WorkflowPreviewResult, WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { WorkflowPickerModal } from '../workflow-picker-modal.js'

const getWorkflowPreview = vi.fn(
  async (): Promise<WorkflowPreviewResult> => ({
    name: 'default',
    source: 'builtin',
    description: 'Standard workflow',
    steps: [{ name: 'implement', edit: true }],
    initialStep: 'implement',
    features: {
      workflowName: 'default',
      source: 'builtin',
      canCompleteWithoutEditing: false,
      canCompleteBeforeFirstEdit: false,
      forcesImplementationOnAllPaths: false,
      hasImplementationPath: true,
      forcesTestWriting: false,
      requiresClearSpec: false,
      changeMode: 'edit_heavy',
      primaryOutputs: ['code'],
      dominantModes: ['implement'],
      targetSurfaces: ['general'],
      hasWriteTestsStep: false,
      hasReviewLoop: false,
      hasFixLoop: false,
      hasParallelReview: false,
      hasWorkflowCall: false,
      hasLoopMonitor: false,
      personaKeys: [],
      policyKeys: [],
      knowledgeKeys: [],
      instructionKeys: [],
      reportFormatKeys: [],
      stepCount: 1,
      editStepCount: 1,
      reviewStepCount: 0,
      investigateStepCount: 0,
      auditStepCount: 0,
      evidence: [],
    },
    overridesAllowed: true,
    strictTier: false,
  }),
)

vi.mock('../../../hooks/use-workflow-picker-prefs.js', () => ({
  useWorkflowPickerPrefs: () => ({
    prefs: {
      pinnedWorkflows: [],
      hiddenCoreWorkflows: [],
      workflowLibrary: {
        enabledPacks: [],
        enabledWorkflows: [],
        autoEnabledWorkflows: [],
        implicitEnabledWorkflows: [],
      },
    },
    enableWorkflowInWorkspace: vi.fn(),
    enablePackInWorkspace: vi.fn(),
    dismissImplicitWorkflow: vi.fn(),
  }),
}))

vi.mock('../../../hooks/use-execution-option-sources.js', () => ({
  useExecutionOptionSources: () => ({
    engineConfig: null,
    catalog: null,
    workflowDefaults: undefined,
    loading: false,
    loadError: null,
  }),
}))

vi.mock('../../../hooks/use-toast.js', () => ({
  usePushToast: () => vi.fn(),
}))

const CORE_WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'builtin',
  stepNames: ['implement'],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

describe('WorkflowPickerModal core inline preview', () => {
  beforeEach(() => {
    installOrbitMock({ getWorkflowPreview })
    getWorkflowPreview.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows inline preview snippet on highlighted core row', async () => {
    render(
      <I18nProvider>
        <WorkflowPickerModal
          open
          onClose={vi.fn()}
          workflows={[CORE_WORKFLOW]}
          value="default"
          onApply={vi.fn()}
          recentWorkflowNames={[]}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /default/i }))

    await waitFor(() => {
      expect(getWorkflowPreview).toHaveBeenCalled()
    })

    expect(screen.getAllByText('edit-heavy').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Steps (1)').length).toBeGreaterThanOrEqual(1)
  })
})
