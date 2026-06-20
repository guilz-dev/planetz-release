import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock, minimalAppState } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { useToastStore } from '../use-toast.js'
import { useWorkspaceSession } from '../use-workspace-session.js'
import { WORKSPACE_TABS_STORAGE_KEY } from '../use-workspace-tabs.js'

vi.mock('../use-chain-actions.js', () => ({
  useChainActions: () => ({
    chainDialog: { open: false, origin: null },
    chainBusy: false,
    requestCreateChain: vi.fn(),
    closeChainDialog: vi.fn(),
    confirmChainCreate: vi.fn(async () => {}),
    unlinkChainEdge: vi.fn(async () => {}),
    materializeChain: vi.fn(async () => {}),
    chainMaterializeBusy: false,
    chainMaterializeWarning: null,
  }),
}))

vi.mock('../use-retry-actions.js', () => ({
  useRetryActions: () => ({
    retryDialog: { open: false, action: null, task: null },
    retryBusy: false,
    requestRetryAction: vi.fn(),
    closeRetryDialog: vi.fn(),
    confirmRetryAction: vi.fn(async () => {}),
  }),
}))

vi.mock('../use-integration-actions.js', () => ({
  useIntegrationActions: () => ({
    hookBearerSecret: null,
    setHookBearerSecret: vi.fn(),
    toggleHookServer: vi.fn(async () => ({})),
    toggleAdapter: vi.fn(async () => {}),
    pushAdapter: vi.fn(async () => {}),
  }),
}))

function renderSessionHook() {
  return renderHook(() => useWorkspaceSession(), {
    wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
  })
}

describe('useWorkspaceSession workspace tabs', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    resetAppStore()
    useToastStore.setState({ toasts: [] })
    storage.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetAppStore()
    useToastStore.setState({ toasts: [] })
  })

  it('records tabs after openRecentWorkspace succeeds', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })
    const stateB = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/b', name: 'b' },
    })
    const openRecentWorkspace = vi.fn(async () => ({ path: '/b', state: stateB }))

    installOrbitMock({
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
      openRecentWorkspace,
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    let switched = false
    await act(async () => {
      switched = await result.current.workspace.onOpenRecentWorkspace('/b')
    })

    expect(openRecentWorkspace).toHaveBeenCalledWith({ path: '/b' })
    expect(switched).toBe(true)
    expect(result.current.workspace.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
    ])
    expect(storage.get(WORKSPACE_TABS_STORAGE_KEY)).toContain('/a')
  })

  it('returns false and leaves tabs unchanged when a duplicate recent switch is skipped', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })
    const stateB = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/b', name: 'b' },
    })
    let resolveOpenRecent!: (value: { path: string; state: typeof stateB }) => void
    const openRecentWorkspace = vi.fn(
      () =>
        new Promise<{ path: string; state: typeof stateB }>((resolve) => {
          resolveOpenRecent = resolve
        }),
    )

    installOrbitMock({
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
      openRecentWorkspace,
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    let firstOpen: Promise<boolean> | undefined
    let secondResult = true

    await act(async () => {
      firstOpen = result.current.workspace.onOpenRecentWorkspace('/b')
      secondResult = await result.current.workspace.onOpenRecentWorkspace('/b')
    })

    expect(openRecentWorkspace).toHaveBeenCalledTimes(1)
    expect(secondResult).toBe(false)
    expect(result.current.workspace.tabs).toEqual([])

    let firstResult = false
    await act(async () => {
      resolveOpenRecent({ path: '/b', state: stateB })
      firstResult = await firstOpen!
    })

    expect(firstResult).toBe(true)
    expect(result.current.workspace.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
    ])
  })

  it('does not record tabs when openWorkspace is canceled', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })

    installOrbitMock({
      selectWorkspace: vi.fn(async () => ({ canceled: true as const })),
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    await act(async () => {
      await result.current.workspace.onChangeWorkspace()
    })

    expect(result.current.workspace.tabs).toEqual([])
  })

  it('shows toast when openRecentWorkspace fails from header path', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })

    installOrbitMock({
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
      openRecentWorkspace: vi.fn(async () => {
        throw new Error('Workspace not found: /gone')
      }),
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    await act(async () => {
      await expect(result.current.workspace.onOpenRecentWorkspace('/gone')).rejects.toThrow(
        'Workspace not found: /gone',
      )
    })

    expect(useToastStore.getState().toasts.some((toast) => toast.kind === 'error')).toBe(true)
    expect(result.current.workspace.tabs).toEqual([])
  })

  it('shows toast when openWorkspace throws from folder picker', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })

    installOrbitMock({
      selectWorkspace: vi.fn(async () => {
        throw new Error('Permission denied')
      }),
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    await act(async () => {
      await result.current.workspace.onChangeWorkspace()
    })

    expect(useToastStore.getState().toasts.some((toast) => toast.kind === 'error')).toBe(true)
    expect(result.current.workspace.tabs).toEqual([])
  })

  it('records tabs after folder picker openWorkspace succeeds', async () => {
    const stateA = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/a', name: 'a' },
    })
    const stateC = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/c', name: 'c' },
    })

    installOrbitMock({
      selectWorkspace: vi.fn(async () => ({
        canceled: false as const,
        path: '/c',
        state: stateC,
      })),
      getWorkspace: vi.fn(async () => ({ path: '/a', state: stateA })),
      getSettings: vi.fn(async () => ({ workspacePath: '/a', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
      onStateUpdate: vi.fn(() => () => {}),
      onUiFocusTask: vi.fn(() => () => {}),
    })
    useAppStore.getState().setState(stateA)

    const { result } = renderSessionHook()

    await act(async () => {
      await result.current.workspace.onChangeWorkspace()
    })

    expect(result.current.workspace.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/c', name: 'c' },
    ])
  })
})
