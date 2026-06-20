import type { TaskViewModel } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useRetryActions } from '../use-retry-actions.js'

function makeTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Test',
    priority: 'normal',
    status: 'failed',
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('useRetryActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls reviseTask with prompt and closes dialog', async () => {
    const reviseTask = vi.fn(async () => ({ taskId: 'task-1' }))
    installOrbitMock({ reviseTask })

    const { result } = renderHook(() => useRetryActions())

    act(() => {
      result.current.requestRetryAction('revise', makeTask())
    })
    expect(result.current.retryDialog.open).toBe(true)
    expect(result.current.retryDialog.action).toBe('revise')

    await act(async () => {
      await result.current.confirmRetryAction('fix the bug')
    })

    await waitFor(() => {
      expect(result.current.retryDialog.open).toBe(false)
    })
    expect(reviseTask).toHaveBeenCalledWith({ taskId: 'task-1', prompt: 'fix the bug' })
  })

  it('does not close dialog while retry is busy', async () => {
    installOrbitMock({
      retryTask: vi.fn(
        () =>
          new Promise<{ taskId: string }>((resolve) => {
            setTimeout(() => resolve({ taskId: 'task-1' }), 50)
          }),
      ),
    })

    const { result } = renderHook(() => useRetryActions())

    act(() => {
      result.current.requestRetryAction('retry', makeTask())
    })

    let confirmPromise: Promise<void>
    act(() => {
      confirmPromise = result.current.confirmRetryAction('')
    })
    act(() => {
      result.current.closeRetryDialog()
    })
    expect(result.current.retryDialog.open).toBe(true)

    await act(async () => {
      await confirmPromise
    })
    expect(result.current.retryDialog.open).toBe(false)
  })
})
