import type {
  ResultSummary,
  TaskResultDiffFile,
  TaskResultDiffSummary,
  TaskViewModel,
} from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { TaskLane } from '../task-lane.js'

const NOW = '2026-05-31T00:00:00.000Z'

function completedTask(): TaskViewModel {
  return {
    id: 'task-completed',
    title: 'Completed task',
    priority: 'normal',
    status: 'completed',
    source: 'takt',
    sourceBranch: 'feature/demo',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function completedResult(task: TaskViewModel): ResultSummary {
  return {
    taskId: task.id,
    title: task.title,
    status: 'completed',
    branch: task.sourceBranch,
    completedAt: NOW,
  }
}

function renderCompletedTaskLane(
  tab: 'All' | 'Done',
  options?: {
    onMerge?: (input: { taskId: string; branch: string }) => Promise<string>
    onListResultDiff?: (input: { taskId: string; branch: string }) => Promise<TaskResultDiffSummary>
    onGetResultDiffFile?: (input: {
      taskId: string
      branch: string
      path: string
    }) => Promise<TaskResultDiffFile>
  },
) {
  const task = completedTask()
  render(
    <I18nProvider>
      <SkinProvider skin={defaultSkin}>
        <TaskLane
          tasks={[task]}
          retries={[]}
          results={[completedResult(task)]}
          executors={[]}
          workflows={[]}
          skin={defaultSkin}
          onSelect={vi.fn()}
          onRequestRetryAction={vi.fn()}
          onMerge={options?.onMerge}
          onListResultDiff={options?.onListResultDiff}
          onGetResultDiffFile={options?.onGetResultDiffFile}
        />
      </SkinProvider>
    </I18nProvider>,
  )

  if (tab !== 'All') {
    fireEvent.click(screen.getByRole('tab', { name: tab }))
  }
}

describe('TaskLane completed result actions', () => {
  afterEach(() => {
    cleanup()
  })

  it.each([
    'All',
    'Done',
  ] as const)('hides Diff when diff handlers are missing on %s tab', (tab) => {
    renderCompletedTaskLane(tab, {
      onMerge: vi.fn(async () => 'ok'),
    })

    expect(screen.queryByRole('button', { name: 'Diff' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Merge (local)' })).toBeTruthy()
  })

  it.each([
    'All',
    'Done',
  ] as const)('shows Diff when both diff handlers are provided on %s tab', (tab) => {
    renderCompletedTaskLane(tab, {
      onMerge: vi.fn(async () => 'ok'),
      onListResultDiff: vi.fn(async () => ({
        taskId: 'task-completed',
        branch: 'feature/demo',
        baseRef: 'main',
        truncated: false,
        files: [],
      })),
      onGetResultDiffFile: vi.fn(async () => ({
        path: 'README.md',
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        binary: false,
        truncated: false,
        lines: [],
      })),
    })

    expect(screen.getByRole('button', { name: 'Diff' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Merge (local)' })).toBeTruthy()
  })
})
