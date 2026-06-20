import type { TaskResultDiffFile, TaskResultDiffSummary, TaskViewModel } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useTaskResultDiff } from '../use-task-result-diff.js'
import { useToastStore } from '../use-toast.js'

const NOW = '2026-05-31T00:00:00.000Z'

function makeTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Task',
    priority: 'normal',
    status: 'completed',
    source: 'takt',
    sourceBranch: 'feature/demo',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeSummary(overrides: Partial<TaskResultDiffSummary> = {}): TaskResultDiffSummary {
  return {
    taskId: 'task-1',
    branch: 'feature/demo',
    baseRef: 'main',
    truncated: false,
    files: [],
    ...overrides,
  }
}

function makeFile(path: string): TaskResultDiffFile {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    binary: false,
    truncated: false,
    lines: [{ kind: 'add', text: '+line', newNo: 1 }],
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useTaskResultDiff', () => {
  afterEach(() => {
    resetAppStore()
    useToastStore.getState().clearToasts()
  })

  it('marks branchMissing when error message wraps BRANCH_NOT_READY', async () => {
    const listTaskResultDiff = vi.fn(async () => {
      throw new Error(
        "Error invoking remote method 'result:diff-summary': Error: BRANCH_NOT_READY: missing",
      )
    })

    const { result } = renderHook(
      () =>
        useTaskResultDiff({
          listTaskResultDiff,
          getTaskResultDiffFile: vi.fn(async () => makeFile('README.md')),
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.openDiff(makeTask(), 'feature/demo')
    })

    expect(result.current.branchMissing).toBe(true)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('marks branchMissing when error code is nested in cause', async () => {
    const listTaskResultDiff = vi.fn(async () => {
      throw new Error('IPC wrapper error', {
        cause: { code: 'BRANCH_NOT_READY', message: 'missing branch' },
      })
    })

    const { result } = renderHook(
      () =>
        useTaskResultDiff({
          listTaskResultDiff,
          getTaskResultDiffFile: vi.fn(async () => makeFile('README.md')),
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.openDiff(makeTask(), 'feature/demo')
    })

    expect(result.current.branchMissing).toBe(true)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('keeps latest selected file when older request resolves late', async () => {
    const delayed = deferred<TaskResultDiffFile>()
    const getTaskResultDiffFile = vi.fn(async ({ path }: { path: string }) => {
      if (path === 'a.ts') return delayed.promise
      return makeFile('b.ts')
    })
    const listTaskResultDiff = vi.fn(async () => makeSummary())

    const { result } = renderHook(
      () =>
        useTaskResultDiff({
          listTaskResultDiff,
          getTaskResultDiffFile,
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.openDiff(makeTask(), 'feature/demo')
    })

    await act(async () => {
      const first = result.current.selectFile('a.ts')
      const second = result.current.selectFile('b.ts')
      await second
      delayed.resolve(makeFile('a.ts'))
      await first
    })

    await waitFor(() => {
      expect(result.current.selectedPath).toBe('b.ts')
      expect(result.current.fileContent?.path).toBe('b.ts')
    })
  })
})
