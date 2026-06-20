import type { TaskViewModel } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useTaskActions } from '../use-task-actions.js'
import { useToastStore } from '../use-toast.js'

function makeTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Test',
    priority: 'normal',
    status: 'pending',
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}

/** Public surface of useTaskActions — catches undefined re-exports (e.g. mistyped return keys). */
const PUBLIC_TASK_ACTION_KEYS = [
  'selectTask',
  'clearSelection',
  'runPendingTask',
  'stopTask',
  'resumeStoppedTask',
  'deletePendingTask',
  'enqueueTask',
  'runTaskNow',
  'deletePromptHistoryItem',
  'listTaskResultDiff',
  'getTaskResultDiffFile',
  'mergeResult',
  'checkResultBranch',
  'refreshResultBranch',
  'createResultPr',
  'openTaskWorkDir',
] as const

describe('useTaskActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetAppStore()
    useToastStore.getState().clearToasts()
  })

  it('exposes the public hook API without throw', () => {
    installOrbitMock({})
    const { result } = renderHook(() => useTaskActions(), { wrapper })
    expect(Object.keys(result.current).toSorted()).toEqual([...PUBLIC_TASK_ACTION_KEYS].toSorted())
    for (const key of PUBLIC_TASK_ACTION_KEYS) {
      expect(result.current[key]).toEqual(expect.any(Function))
    }
  })

  it('selectTask syncs app store and orbit', () => {
    const selectTask = vi.fn(async () => {})
    installOrbitMock({ selectTask })

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    act(() => {
      result.current.selectTask('task-abc')
    })

    expect(selectTask).toHaveBeenCalledWith('task-abc')
  })

  it('runPendingTask calls orbit with task id', async () => {
    const runPendingTask = vi.fn(async () => {})
    installOrbitMock({ runPendingTask })

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await act(async () => {
      await result.current.runPendingTask(makeTask())
    })

    expect(runPendingTask).toHaveBeenCalledWith({ taskId: 'task-1' })
  })

  it('deletePendingTask calls orbit after confirm', async () => {
    const deleteTask = vi.fn(async () => {})
    installOrbitMock({ deleteTask })
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await act(async () => {
      await result.current.deletePendingTask(makeTask())
    })

    expect(deleteTask).toHaveBeenCalledWith({ taskId: 'task-1' })
  })

  it('deletePendingTask uses requestConfirm when provided', async () => {
    const deleteTask = vi.fn(async () => {})
    installOrbitMock({ deleteTask })
    const requestConfirm = vi.fn(async () => true)

    const { result } = renderHook(() => useTaskActions({ requestConfirm }), { wrapper })

    await act(async () => {
      await result.current.deletePendingTask(makeTask())
    })

    expect(requestConfirm).toHaveBeenCalled()
    expect(deleteTask).toHaveBeenCalledWith({ taskId: 'task-1' })
  })

  it('deletePendingTask skips orbit when confirm is declined', async () => {
    const deleteTask = vi.fn(async () => {})
    installOrbitMock({ deleteTask })
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await act(async () => {
      await result.current.deletePendingTask(makeTask())
    })

    expect(deleteTask).not.toHaveBeenCalled()
  })

  it('enqueueTask forwards draft fields to orbit', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-new' }))
    installOrbitMock({ enqueueTask })

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await act(async () => {
      await result.current.enqueueTask({
        body: 'do work',
        workflowMode: 'manual',
        workflow: 'default',
        provider: 'cursor',
        model: 'auto',
      })
    })

    expect(enqueueTask).toHaveBeenCalledWith({
      body: 'do work',
      workflowMode: 'manual',
      workflow: 'default',
      recentWorkflowNames: [],
      provider: 'cursor',
      model: 'auto',
    })
  })

  it('runTaskNow pushes error toast and rethrows on failure', async () => {
    installOrbitMock({
      runTaskNow: vi.fn(async () => {
        throw new Error('dispatch failed')
      }),
    })

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await expect(
      act(async () => {
        await result.current.runTaskNow({
          body: 'x',
          workflowMode: 'manual',
          workflow: 'default',
        })
      }),
    ).rejects.toThrow('dispatch failed')

    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.kind === 'error')).toBe(true)
    })
  })

  it('runTaskNow falls back to generic toast when bridge returns no payload', async () => {
    installOrbitMock({
      runTaskNow: vi.fn(async () => undefined as never),
    })

    const { result } = renderHook(() => useTaskActions(), { wrapper })

    await act(async () => {
      await result.current.runTaskNow({
        body: 'x',
        workflowMode: 'manual',
        workflow: 'default',
      })
    })

    await waitFor(() => {
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.kind === 'info' && toast.message.length > 0),
      ).toBe(true)
    })
  })
})
