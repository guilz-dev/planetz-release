import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock, minimalAppState } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { useAppStore } from '../../store/app-store.js'
import { useWorkspaceBootstrap } from '../use-workspace-bootstrap.js'

describe('useWorkspaceBootstrap', () => {
  beforeEach(() => {
    resetAppStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('openWorkspace applies state when user selects a folder', async () => {
    const nextState = minimalAppState()
    const selectWorkspace = vi.fn(async () => ({
      canceled: false as const,
      path: '/tmp/ws',
      state: nextState,
    }))
    installOrbitMock({
      selectWorkspace,
      getSettings: vi.fn(async () => ({ workspacePath: '/tmp/ws', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
    })

    const { result } = renderHook(() => useWorkspaceBootstrap())

    await act(async () => {
      await result.current.openWorkspace()
    })

    expect(selectWorkspace).toHaveBeenCalled()
    expect(useAppStore.getState().state).toEqual(nextState)
    expect(result.current.opening).toBe(false)
  })

  it('ignores duplicate openRecentWorkspace calls while a switch is in flight', async () => {
    const nextState = minimalAppState({
      workspace: { ...minimalAppState().workspace, path: '/tmp/next', name: 'next' },
    })
    let resolveOpenRecent!: (value: { path: string; state: typeof nextState }) => void
    let openRecentPending = false
    const openRecentWorkspace = vi.fn(
      () =>
        new Promise<{ path: string; state: typeof nextState }>((resolve) => {
          openRecentPending = true
          resolveOpenRecent = resolve
        }),
    )

    installOrbitMock({
      openRecentWorkspace,
      getWorkspace: vi.fn(async () => ({ path: '/tmp/ws', state: minimalAppState() })),
      getSettings: vi.fn(async () => ({ workspacePath: '/tmp/next', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
    })
    useAppStore.getState().setState(minimalAppState())

    const { result } = renderHook(() => useWorkspaceBootstrap())

    let firstOpen: Promise<boolean> | undefined
    let secondOpen: Promise<boolean> | undefined

    await act(async () => {
      firstOpen = result.current.openRecentWorkspace('/tmp/next')
      secondOpen = result.current.openRecentWorkspace('/tmp/next')
      await Promise.resolve()
    })

    expect(openRecentWorkspace).toHaveBeenCalledTimes(1)

    if (!openRecentPending) {
      throw new Error('Expected openRecentWorkspace promise to remain pending')
    }
    if (!firstOpen || !secondOpen) {
      throw new Error('Expected both openRecentWorkspace calls to return promises')
    }
    const pendingFirstOpen = firstOpen
    const pendingSecondOpen = secondOpen
    resolveOpenRecent({ path: '/tmp/next', state: nextState })

    let firstResult = false
    let secondResult = true
    await act(async () => {
      ;[firstResult, secondResult] = await Promise.all([pendingFirstOpen, pendingSecondOpen])
    })

    expect(useAppStore.getState().state).toEqual(nextState)
    expect(useAppStore.getState().workspaceSwitching).toBe(false)
    expect(result.current.opening).toBe(false)
    expect(firstResult).toBe(true)
    expect(secondResult).toBe(false)
  })

  it('restores state when folder selection is canceled', async () => {
    const current = minimalAppState({ workspace: { ...minimalAppState().workspace, name: 'keep' } })
    const selectWorkspace = vi.fn(async () => ({ canceled: true as const }))
    const getWorkspace = vi.fn(async () => ({ path: '/tmp/ws', state: current }))
    installOrbitMock({
      selectWorkspace,
      getWorkspace,
      getSettings: vi.fn(async () => ({ workspacePath: '/tmp/ws', config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
    })
    useAppStore.getState().setState(current)

    const { result } = renderHook(() => useWorkspaceBootstrap())

    await act(async () => {
      await result.current.openWorkspace()
    })

    expect(getWorkspace).toHaveBeenCalled()
    expect(useAppStore.getState().state).toEqual(current)
    expect(useAppStore.getState().workspaceSwitching).toBe(false)
  })

  it('subscribes to onStateUpdate on mount', async () => {
    const onStateUpdate = vi.fn(() => () => {})
    installOrbitMock({
      onStateUpdate,
      getWorkspace: vi.fn(async () => ({ path: null, state: null })),
      getSettings: vi.fn(async () => ({ workspacePath: null, config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
    })

    const { result } = renderHook(() => useWorkspaceBootstrap())

    await waitFor(() => {
      expect(onStateUpdate).toHaveBeenCalled()
      expect(result.current.hydrating).toBe(false)
    })
  })

  it('switches to task view when onUiFocusTask fires', async () => {
    let focusHandler: ((taskId: string) => void) | undefined
    installOrbitMock({
      onUiFocusTask: vi.fn((cb) => {
        focusHandler = cb
        return () => {}
      }),
      getWorkspace: vi.fn(async () => ({ path: null, state: null })),
      getSettings: vi.fn(async () => ({ workspacePath: null, config: null })),
      listPromptHistory: vi.fn(async () => []),
      listRecentWorkspaces: vi.fn(async () => []),
    })
    useAppStore.getState().setState(minimalAppState())
    useAppStore.getState().setActiveView('chat')
    expect(useAppStore.getState().activeView).toBe('spec-studio')

    renderHook(() => useWorkspaceBootstrap())

    await waitFor(() => {
      expect(focusHandler).toBeTypeOf('function')
    })

    act(() => {
      focusHandler?.('task-99')
    })

    expect(useAppStore.getState().activeView).toBe('task')
    expect(useAppStore.getState().state?.selectedTaskId).toBe('task-99')
  })
})
