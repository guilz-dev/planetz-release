import type { WorkflowSummary } from '@planetz/shared'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  desktopCapabilities,
  installOrbitMock,
  minimalAppState,
} from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { defaultSkin } from '../../skins/default-skin.js'
import { normalizeActiveView, useAppStore } from '../../store/app-store.js'
import { MainDashboard } from '../main-dashboard.js'

vi.mock('../settings/workflow-editor.js', () => ({
  WorkflowEditor: () => null,
}))

const DEFAULT_WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'project',
  stepNames: [],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  let reject: (reason?: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createProps(
  overrides: Partial<ComponentProps<typeof MainDashboard>> = {},
): ComponentProps<typeof MainDashboard> {
  return {
    state: minimalAppState({ workflows: [DEFAULT_WORKFLOW] }),
    skin: defaultSkin,
    promptHistory: [],
    workspace: {
      checkingCli: false,
      onRecheckCli: vi.fn(),
      recentWorkspaces: [],
      tabs: [],
      onOpenRecentWorkspace: vi.fn(async () => true),
      onRemoveRecentWorkspace: vi.fn(async () => {}),
      onRefreshPromptHistory: vi.fn(async () => {}),
      onChangeWorkspace: vi.fn(),
      onSelectWorkspaceTab: vi.fn(),
      onCloseWorkspaceTab: vi.fn(),
    },
    settings: {
      settingsOpen: false,
      settingsConfig: null,
      settingsInitialTab: null,
      settingsInitialFacetSelection: null,
      workflowCreateRequest: 0,
      onOpenSettings: vi.fn(),
      onOpenSettingsToFacets: vi.fn(),
      onOpenSettingsToIntegrations: vi.fn(),
      onNewWorkflow: vi.fn(),
      onCloseSettings: vi.fn(),
      onSettingsSaved: vi.fn(),
    },
    retry: {
      retryDialog: { open: false, action: null, task: null },
      retryBusy: false,
      onRequestRetryAction: vi.fn(),
      onCloseRetryDialog: vi.fn(),
      onConfirmRetryAction: vi.fn(async () => {}),
    },
    chain: {
      chainDialog: { open: false, origin: null },
      chainBusy: false,
      onRequestCreateChain: vi.fn(),
      onCloseChainDialog: vi.fn(),
      onConfirmChainCreate: vi.fn(async () => {}),
      onUnlinkChainEdge: vi.fn(async () => {}),
      onMaterializeChain: vi.fn(async () => {}),
      chainMaterializeBusy: false,
      chainMaterializeWarning: null,
    },
    integration: {
      hookBearerSecret: null,
      onDismissHookBearerSecret: vi.fn(),
      onToggleHookServer: vi.fn(async () => ({})),
      onToggleAdapter: vi.fn(async () => {}),
      onPushAdapter: vi.fn(async () => {}),
    },
    ...overrides,
  }
}

type DashboardBridgeOverrides = Partial<
  Pick<OrbitBridge, 'enqueueTask' | 'runTaskNow' | 'getDesktopCapabilities'>
>

function renderDashboard(
  overrides: Partial<ComponentProps<typeof MainDashboard>> = {},
  overridesBridge: DashboardBridgeOverrides = {},
  initialActiveView: Parameters<typeof normalizeActiveView>[0] = 'task',
) {
  const enqueueTask =
    overridesBridge.enqueueTask ??
    vi.fn<OrbitBridge['enqueueTask']>(async () => ({ taskId: 'task-enqueued' }))
  const runTaskNow =
    overridesBridge.runTaskNow ??
    vi.fn<NonNullable<OrbitBridge['runTaskNow']>>(async () => ({ taskId: 'task-run-now' }))
  const getDesktopCapabilities =
    overridesBridge.getDesktopCapabilities ??
    vi.fn<OrbitBridge['getDesktopCapabilities']>(async () =>
      desktopCapabilities({ conversationModeEnabled: false }),
    )
  vi.stubGlobal('__BRIDGE_REVISION__', 'test-bridge-revision')
  installOrbitMock({ enqueueTask, runTaskNow, getDesktopCapabilities })
  useAppStore.setState({
    uiLanguage: 'en',
    selectedWorkflow: 'default',
    activeView: normalizeActiveView(initialActiveView),
    panelVisibility: { tasks: true, composer: true },
  })
  const view = render(
    <I18nProvider>
      <MainDashboard {...createProps(overrides)} />
    </I18nProvider>,
  )
  return { enqueueTask, runTaskNow, ...view }
}

describe('MainDashboard title routing', () => {
  beforeEach(() => {
    resetAppStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('does not send title when enqueueing from composer', async () => {
    const { enqueueTask } = renderDashboard()
    fireEvent.change(
      screen.getByPlaceholderText("Describe what you'd like the agent to take on…"),
      {
        target: { value: 'Investigate flaky tests in CI' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enqueue' }))

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Investigate flaky tests in CI',
        workflowMode: 'auto',
      }),
    )
    const payload = vi.mocked(enqueueTask).mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty('title')
    expect(payload).not.toHaveProperty('workflow')
  })

  it('does not send title when run-now from composer', async () => {
    const { runTaskNow } = renderDashboard()
    fireEvent.change(
      screen.getByPlaceholderText("Describe what you'd like the agent to take on…"),
      {
        target: { value: 'Run urgent triage workflow now' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run now' }))

    await waitFor(() => {
      expect(runTaskNow).toHaveBeenCalledTimes(1)
    })
    expect(runTaskNow).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Run urgent triage workflow now',
        workflowMode: 'auto',
      }),
    )
    const payload = vi.mocked(runTaskNow).mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty('title')
    expect(payload).not.toHaveProperty('workflow')
  })

  it('shows and clears optimistic preparing task while enqueue is pending', async () => {
    const enqueueDeferred = createDeferred<{ taskId: string }>()
    const enqueueTask = vi.fn<OrbitBridge['enqueueTask']>(() => enqueueDeferred.promise)
    renderDashboard({}, { enqueueTask })
    fireEvent.change(
      screen.getByPlaceholderText("Describe what you'd like the agent to take on…"),
      {
        target: { value: 'Investigate flaky tests in CI' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enqueue' }))

    await waitFor(() => {
      expect(screen.getByText('Preparing... Investigate flaky tests in CI')).toBeTruthy()
    })

    enqueueDeferred.resolve({ taskId: 'task-enqueued' })

    await waitFor(() => {
      expect(screen.queryByText('Preparing... Investigate flaky tests in CI')).toBeNull()
    })
  })

  it('clears optimistic preparing task when workspace changes', async () => {
    const enqueueDeferred = createDeferred<{ taskId: string }>()
    const enqueueTask = vi.fn<OrbitBridge['enqueueTask']>(() => enqueueDeferred.promise)
    const view = renderDashboard({}, { enqueueTask })
    fireEvent.change(
      screen.getByPlaceholderText("Describe what you'd like the agent to take on…"),
      {
        target: { value: 'Investigate flaky tests in CI' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enqueue' }))

    await waitFor(() => {
      expect(screen.getByText('Preparing... Investigate flaky tests in CI')).toBeTruthy()
    })

    const currentWorkspace = minimalAppState().workspace
    view.rerender(
      <I18nProvider>
        <MainDashboard
          {...createProps({
            state: minimalAppState({
              workflows: [DEFAULT_WORKFLOW],
              workspace: {
                ...currentWorkspace,
                id: 'ws-changed',
                name: 'changed',
                path: '/tmp/changed-ws',
                sidecarPath: '/tmp/changed-ws/.orbit',
              },
            }),
          })}
        />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByText('Preparing... Investigate flaky tests in CI')).toBeNull()
    })
    enqueueDeferred.resolve({ taskId: 'task-enqueued' })
  })

  it('selects issue view from the primary rail', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Issue' }))
    expect(useAppStore.getState().activeView).toBe('issue')
  })

  it('shows spec studio rail entry by default', () => {
    renderDashboard()
    const nav = screen.getByRole('navigation', { name: 'Primary view' })
    expect(within(nav).getByRole('button', { name: 'Spec Studio' })).toBeTruthy()
  })

  it('renders spec studio while chat capability is still loading', async () => {
    const capabilitiesDeferred = createDeferred<ReturnType<typeof desktopCapabilities>>()
    renderDashboard(
      {},
      {
        getDesktopCapabilities: vi.fn<OrbitBridge['getDesktopCapabilities']>(
          async () => capabilitiesDeferred.promise,
        ),
      },
      'chat',
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New spec' })).toBeTruthy()
    })
    capabilitiesDeferred.resolve(desktopCapabilities({ conversationModeEnabled: false }))
  })

  it('keeps spec studio active when chat capability is disabled', async () => {
    renderDashboard(
      {},
      {
        getDesktopCapabilities: vi.fn<OrbitBridge['getDesktopCapabilities']>(async () =>
          desktopCapabilities({ conversationModeEnabled: false }),
        ),
      },
      'chat',
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New spec' })).toBeTruthy()
    })
    expect(useAppStore.getState().activeView).toBe('spec-studio')
  })

  it('shows spec studio rail entry when conversation mode is enabled', async () => {
    renderDashboard(
      {},
      {
        getDesktopCapabilities: vi.fn<OrbitBridge['getDesktopCapabilities']>(async () =>
          desktopCapabilities({ conversationModeEnabled: true }),
        ),
      },
    )
    await waitFor(() => {
      const nav = screen.getByRole('navigation', { name: 'Primary view' })
      expect(within(nav).getByRole('button', { name: 'Spec Studio' })).toBeTruthy()
    })
  })

  it('renders Issue tab content when Issue rail is selected', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Issue' }))
    await waitFor(() => {
      expect(screen.getByText('Open issues')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('renders workspace tab strip when two or more tabs are provided', async () => {
    renderDashboard({
      workspace: {
        ...createProps().workspace,
        tabs: [
          { path: '/work/a', name: 'a' },
          { path: '/work/b', name: 'b' },
        ],
      },
      state: minimalAppState({
        workflows: [DEFAULT_WORKFLOW],
        workspace: { ...minimalAppState().workspace, path: '/work/b', name: 'b' },
      }),
    })

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Recent workspace tabs' })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'b', pressed: true })).toBeTruthy()
  })

  it('does not show task-only Add task restore affordances on issue view', async () => {
    useAppStore.setState({
      panelVisibility: { tasks: true, composer: false },
    })
    renderDashboard({}, {}, 'issue')

    await waitFor(() => {
      expect(screen.getByText('Open issues')).toBeTruthy()
    })
    expect(screen.queryByRole('toolbar', { name: 'Restore closed panels' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.queryByText('Panels')).toBeNull()
    expect(screen.queryByText('Add task')).toBeNull()
  })
})
