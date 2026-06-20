import type { WorkflowSummary } from '@planetz/shared'
import { EMPTY_WORKFLOW_LIBRARY_PREFS, workflowPickerSurfacePrefsFromUi } from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { WorkflowCatalogLibraryTab } from '../workflow-catalog-library-tab.js'

const { mockDismissImplicitWorkflow, mockUseWorkflowLibraryPrefs } = vi.hoisted(() => {
  const mockDismissImplicitWorkflow = vi.fn(async () => {})
  const mockUseWorkflowLibraryPrefs = vi.fn(() => ({
    prefs: workflowPickerSurfacePrefsFromUi({
      workflowLibrary: {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        implicitEnabledWorkflows: ['terraform'],
      },
    }),
    dismissImplicitWorkflow: mockDismissImplicitWorkflow,
    enableWorkflowInWorkspace: vi.fn(),
    disableWorkflowInWorkspace: vi.fn(),
    enableWorkflowForAuto: vi.fn(),
    disableWorkflowForAuto: vi.fn(),
    enablePackInWorkspace: vi.fn(),
  }))
  return { mockDismissImplicitWorkflow, mockUseWorkflowLibraryPrefs }
})

vi.mock('../../../hooks/use-workflow-library-prefs.js', () => ({
  useWorkflowLibraryPrefs: () => mockUseWorkflowLibraryPrefs(),
}))

vi.mock('../../../hooks/use-workflow-preview.js', () => ({
  useWorkflowPreview: () => ({ preview: null, loading: false, loadError: null }),
}))

const TERRAFORM: WorkflowSummary = {
  name: 'terraform',
  source: 'builtin',
  stepNames: [],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

function renderTab() {
  return render(
    <I18nProvider>
      <WorkflowCatalogLibraryTab workflows={[TERRAFORM]} query="" onCopyToProject={vi.fn()} />
    </I18nProvider>,
  )
}

describe('WorkflowCatalogLibraryTab', () => {
  beforeEach(() => {
    mockUseWorkflowLibraryPrefs.mockImplementation(() => ({
      prefs: workflowPickerSurfacePrefsFromUi({
        workflowLibrary: {
          ...EMPTY_WORKFLOW_LIBRARY_PREFS,
          implicitEnabledWorkflows: ['terraform'],
        },
      }),
      dismissImplicitWorkflow: mockDismissImplicitWorkflow,
      enableWorkflowInWorkspace: vi.fn(),
      disableWorkflowInWorkspace: vi.fn(),
      enableWorkflowForAuto: vi.fn(),
      disableWorkflowForAuto: vi.fn(),
      enablePackInWorkspace: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanup()
    mockDismissImplicitWorkflow.mockClear()
    mockUseWorkflowLibraryPrefs.mockClear()
  })

  it('shows implicit enable badge and dismiss for implicitly enabled library workflows', () => {
    renderTab()

    expect(screen.getByText('Shown in picker because you used it before')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove from picker: terraform' }))
    expect(mockDismissImplicitWorkflow).toHaveBeenCalledWith('terraform')
  })

  it('hides implicit badge when the workflow is explicitly enabled in workspace', () => {
    mockUseWorkflowLibraryPrefs.mockImplementation(() => ({
      prefs: workflowPickerSurfacePrefsFromUi({
        workflowLibrary: {
          ...EMPTY_WORKFLOW_LIBRARY_PREFS,
          implicitEnabledWorkflows: ['terraform'],
          enabledWorkflows: ['terraform'],
        },
      }),
      dismissImplicitWorkflow: mockDismissImplicitWorkflow,
      enableWorkflowInWorkspace: vi.fn(),
      disableWorkflowInWorkspace: vi.fn(),
      enableWorkflowForAuto: vi.fn(),
      disableWorkflowForAuto: vi.fn(),
      enablePackInWorkspace: vi.fn(),
    }))

    renderTab()

    expect(screen.queryByText('Shown in picker because you used it before')).toBeNull()
  })

  it('keeps visible-in-picker off for implicit-only library workflows', () => {
    renderTab()

    const visibleToggle = screen.getByRole('switch', { name: 'Visible in picker: terraform' })
    expect(visibleToggle.getAttribute('aria-checked')).toBe('false')
  })
})
