import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore, WORKFLOW_MODE_STORAGE_KEY } from '../app-store.js'

describe('app-store workflowMode', () => {
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
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { localStorage }))
    useAppStore.setState({ workflowMode: 'auto', lastAutoDecision: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ workflowMode: 'auto', lastAutoDecision: null })
  })

  it('defaults workflowMode to auto', () => {
    expect(useAppStore.getState().workflowMode).toBe('auto')
  })

  it('persists workflowMode to localStorage', () => {
    useAppStore.getState().setWorkflowMode('manual')
    expect(window.localStorage.getItem(WORKFLOW_MODE_STORAGE_KEY)).toBe('manual')
    expect(useAppStore.getState().workflowMode).toBe('manual')
  })

  it('restores manual mode from localStorage on read', () => {
    window.localStorage.setItem(WORKFLOW_MODE_STORAGE_KEY, 'manual')
    useAppStore.getState().setWorkflowMode('manual')
    expect(useAppStore.getState().workflowMode).toBe('manual')
  })
})
