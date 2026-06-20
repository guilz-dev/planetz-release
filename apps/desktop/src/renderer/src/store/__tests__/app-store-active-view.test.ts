import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_VIEW_STORAGE_KEY, readStoredActiveView, useAppStore } from '../app-store.js'

function createStorageMock(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    storage: store,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  }
}

describe('app-store activeView issue', () => {
  beforeEach(() => {
    const { localStorage } = createStorageMock()
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { localStorage }))
    useAppStore.setState({ activeView: 'task' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ activeView: 'task' })
  })

  it('clears decisions task filter when switching views via setActiveView', () => {
    useAppStore.setState({ decisionsFilterTaskId: 'task-42' })
    useAppStore.getState().setActiveView('summary')
    expect(useAppStore.getState().decisionsFilterTaskId).toBeNull()
  })

  it('openDecisionsForTask sets filter without going through setActiveView', () => {
    useAppStore.getState().openDecisionsForTask('task-99')
    expect(useAppStore.getState().activeView).toBe('decisions')
    expect(useAppStore.getState().decisionsFilterTaskId).toBe('task-99')
  })

  it('persists issue view to localStorage', () => {
    useAppStore.getState().setActiveView('issue')
    expect(useAppStore.getState().activeView).toBe('issue')
    expect(localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)).toBe('issue')

    useAppStore.getState().setActiveView('decisions')
    expect(useAppStore.getState().activeView).toBe('decisions')
    expect(localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)).toBe('decisions')
  })

  it('readStoredActiveView restores issue from localStorage', () => {
    const { localStorage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'issue' })
    expect(readStoredActiveView(localStorage)).toBe('issue')
  })

  it('readStoredActiveView migrates legacy chat to spec-studio and rewrites storage', () => {
    const { localStorage, storage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'chat' })
    expect(readStoredActiveView(localStorage)).toBe('spec-studio')
    expect(storage.get(ACTIVE_VIEW_STORAGE_KEY)).toBe('spec-studio')
  })

  it('readStoredActiveView migrates legacy spec-desk to spec-studio', () => {
    const { localStorage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'spec-desk' })
    expect(readStoredActiveView(localStorage)).toBe('spec-studio')
  })

  it('setActiveView normalizes legacy chat to spec-studio in store and localStorage', () => {
    useAppStore.getState().setActiveView('chat')
    expect(useAppStore.getState().activeView).toBe('spec-studio')
    expect(localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)).toBe('spec-studio')
  })

  it('readStoredActiveView falls back to task for unknown values', () => {
    const { localStorage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'unknown-view' })
    expect(readStoredActiveView(localStorage)).toBe('task')
  })

  it('readStoredActiveView falls back when window.localStorage accessor throws', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('localStorage blocked')
      },
    })
    expect(readStoredActiveView()).toBe('task')
  })

  it('initializes store activeView from localStorage issue value', async () => {
    vi.resetModules()
    const { localStorage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'issue' })
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { localStorage }))

    const { useAppStore: freshStore } = await import('../app-store.js')
    expect(freshStore.getState().activeView).toBe('issue')
  })

  it('initializes store activeView from legacy chat localStorage as spec-studio', async () => {
    vi.resetModules()
    const { localStorage, storage } = createStorageMock({ [ACTIVE_VIEW_STORAGE_KEY]: 'chat' })
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { localStorage }))

    const { useAppStore: freshStore } = await import('../app-store.js')
    expect(freshStore.getState().activeView).toBe('spec-studio')
    expect(storage.get(ACTIVE_VIEW_STORAGE_KEY)).toBe('spec-studio')
  })
})
