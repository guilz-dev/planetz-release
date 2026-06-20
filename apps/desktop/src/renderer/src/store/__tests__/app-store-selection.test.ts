import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { minimalAppState } from '../../__tests__/orbit-mock.js'
import { useAppStore } from '../app-store.js'

const stateWithSelection = (selectedTaskId: string | undefined) =>
  minimalAppState({ selectedTaskId, tasks: [] })

describe('useAppStore selection guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
    useAppStore.setState({
      state: stateWithSelection('a1'),
      selectionGuardUntil: 0,
      stateRevision: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a recent local selection when a stale main update arrives', () => {
    useAppStore.getState().setSelectedTaskId('a2')
    useAppStore.getState().setState(stateWithSelection('a1'))
    expect(useAppStore.getState().state?.selectedTaskId).toBe('a2')
  })

  it('applies main-process selection after the guard window', () => {
    useAppStore.setState({ selectionGuardUntil: 0 })
    useAppStore.getState().setState(stateWithSelection('a2'))
    expect(useAppStore.getState().state?.selectedTaskId).toBe('a2')
  })
})
