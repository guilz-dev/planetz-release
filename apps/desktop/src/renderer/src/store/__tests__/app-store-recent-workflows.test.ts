import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStorageMock } from '../../__tests__/orbit-mock.js'
import { parseStoredRecentWorkflowNames } from '../../lib/recent-workflows.js'
import { RECENT_WORKFLOWS_STORAGE_KEY, useAppStore } from '../app-store.js'

describe('useAppStore recentWorkflowNames', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { localStorage: storage }))
    useAppStore.setState({ recentWorkflowNames: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ recentWorkflowNames: [] })
  })

  it('pushRecentWorkflow prepends and persists to localStorage', () => {
    useAppStore.getState().pushRecentWorkflow('alpha')
    useAppStore.getState().pushRecentWorkflow('beta')

    expect(useAppStore.getState().recentWorkflowNames).toEqual(['beta', 'alpha'])
    expect(JSON.parse(window.localStorage.getItem(RECENT_WORKFLOWS_STORAGE_KEY) ?? '[]')).toEqual([
      'beta',
      'alpha',
    ])
  })

  it('re-selecting moves the workflow to the front', () => {
    useAppStore.getState().pushRecentWorkflow('a')
    useAppStore.getState().pushRecentWorkflow('b')
    useAppStore.getState().pushRecentWorkflow('c')
    useAppStore.getState().pushRecentWorkflow('a')

    expect(useAppStore.getState().recentWorkflowNames).toEqual(['a', 'c', 'b'])
  })

  it('caps at five entries', () => {
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
      useAppStore.getState().pushRecentWorkflow(name)
    }
    expect(useAppStore.getState().recentWorkflowNames).toEqual(['f', 'e', 'd', 'c', 'b'])
  })

  it('ignores empty workflow names', () => {
    useAppStore.getState().pushRecentWorkflow('a')
    useAppStore.getState().pushRecentWorkflow('  ')
    expect(useAppStore.getState().recentWorkflowNames).toEqual(['a'])
  })

  it('selectWorkflowForComposer updates selection and recent list', () => {
    useAppStore.getState().selectWorkflowForComposer('gamma')
    expect(useAppStore.getState().selectedWorkflow).toBe('gamma')
    expect(useAppStore.getState().recentWorkflowNames).toEqual(['gamma'])
  })

  it('normalizes invalid localStorage the same way as readRecentWorkflows', () => {
    window.localStorage.setItem(
      RECENT_WORKFLOWS_STORAGE_KEY,
      JSON.stringify(['  foo  ', 'foo', 'bar', 99, null, '']),
    )
    const normalized = parseStoredRecentWorkflowNames(
      JSON.parse(window.localStorage.getItem(RECENT_WORKFLOWS_STORAGE_KEY) ?? '[]'),
    )
    expect(normalized).toEqual(['foo', 'bar'])
  })
})
