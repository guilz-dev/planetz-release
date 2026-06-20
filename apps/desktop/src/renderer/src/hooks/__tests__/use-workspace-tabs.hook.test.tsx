import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { minimalAppState } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { useToastStore } from '../use-toast.js'
import { useWorkspaceTabs, WORKSPACE_TABS_STORAGE_KEY } from '../use-workspace-tabs.js'

function renderTabsHook() {
  return renderHook(() => useWorkspaceTabs(), {
    wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
  })
}

function setActiveWorkspace(path: string, name: string) {
  useAppStore.getState().setState(
    minimalAppState({
      workspace: { ...minimalAppState().workspace, path, name },
    }),
  )
}

describe('useWorkspaceTabs', () => {
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

  it('starts with no tabs from empty sessionStorage', () => {
    const { result } = renderTabsHook()
    expect(result.current.tabs).toEqual([])
  })

  it('recordTransition builds tab list across switches', async () => {
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
    })
    expect(result.current.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
    ])

    act(() => {
      result.current.recordTransition('/b', '/c', { prevName: 'b', nextName: 'c' })
    })
    expect(result.current.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
      { path: '/c', name: 'c' },
    ])
  })

  it('does not duplicate tabs when revisiting an existing workspace', () => {
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.recordTransition('/b', '/a', { prevName: 'b', nextName: 'a' })
    })

    expect(result.current.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
    ])
  })

  it('selectTab calls bound switch and no-ops on active path', async () => {
    const switchWorkspace = vi.fn(async () => true)
    const { result } = renderTabsHook()

    act(() => {
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/a', 'a')
    })

    await act(async () => {
      await result.current.selectTab('/a')
    })
    expect(switchWorkspace).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.selectTab('/b')
    })
    expect(switchWorkspace).toHaveBeenCalledWith('/b')
  })

  it('reportSwitchFailure removes stale tab and shows toast when workspace is missing', () => {
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/gone', { prevName: 'a', nextName: 'gone' })
      result.current.reportSwitchFailure(new Error('Workspace not found: /gone'), '/gone')
    })

    expect(result.current.tabs).toEqual([{ path: '/a', name: 'a' }])
    expect(useToastStore.getState().toasts.some((toast) => toast.kind === 'error')).toBe(true)
  })

  it('updates tab name when revisiting with a new workspace name', () => {
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.recordTransition('/b', '/a', { prevName: 'b', nextName: 'a-renamed' })
    })

    expect(result.current.tabs).toEqual([
      { path: '/a', name: 'a-renamed' },
      { path: '/b', name: 'b' },
    ])
  })

  it('closeTab removes background tab without switching', async () => {
    const switchWorkspace = vi.fn(async () => true)
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/b', 'b')
    })

    await act(async () => {
      await result.current.closeTab('/a')
    })

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(result.current.tabs).toEqual([{ path: '/b', name: 'b' }])
  })

  it('closeTab switches to fallback before removing active tab', async () => {
    const switchWorkspace = vi.fn(async () => true)
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/b', 'b')
    })

    await act(async () => {
      await result.current.closeTab('/b')
    })

    expect(switchWorkspace).toHaveBeenCalledWith('/a')
    expect(result.current.tabs).toEqual([{ path: '/a', name: 'a' }])
  })

  it('removes active tab when switch succeeds even if state path text differs', async () => {
    const switchWorkspace = vi.fn(async () => true)
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/proj/foo', '/proj/bar', {
        prevName: 'foo',
        nextName: 'bar',
      })
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/proj/bar', 'bar')
    })

    await act(async () => {
      await result.current.closeTab('/proj/bar')
    })

    expect(switchWorkspace).toHaveBeenCalledWith('/proj/foo')
    expect(result.current.tabs).toEqual([{ path: '/proj/foo', name: 'foo' }])
  })

  it('keeps tabs when active close fallback switch fails', async () => {
    const switchWorkspace = vi.fn(async () => false)
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/b', 'b')
    })

    await act(async () => {
      await result.current.closeTab('/b')
    })

    expect(result.current.tabs).toEqual([
      { path: '/a', name: 'a' },
      { path: '/b', name: 'b' },
    ])
  })

  it('no-ops select and close while workspaceSwitching is true', async () => {
    const switchWorkspace = vi.fn(async () => true)
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
      result.current.bindSwitchWorkspace(switchWorkspace)
      setActiveWorkspace('/b', 'b')
      useAppStore.getState().setWorkspaceSwitching(true)
    })

    await act(async () => {
      await result.current.selectTab('/a')
      await result.current.closeTab('/a')
    })

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(result.current.tabs).toHaveLength(2)
  })

  it('persists tabs to sessionStorage', async () => {
    const { result } = renderTabsHook()

    act(() => {
      result.current.recordTransition('/a', '/b', { prevName: 'a', nextName: 'b' })
    })

    await waitFor(() => {
      expect(storage.get(WORKSPACE_TABS_STORAGE_KEY)).toContain('/a')
    })
  })
})
