import type { ResultSummary, TaskViewModel } from '@planetz/shared'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { DetailPanel } from '../detail-panel.js'

export const DETAIL_PANEL_TEST_NOW = '2026-05-31T00:00:00.000Z'

export const SAMPLE_PULL_REQUEST: NonNullable<ResultSummary['pullRequest']> = {
  number: 42,
  url: 'https://github.com/example/repo/pull/42',
  state: 'open',
  isDraft: false,
}

export function completedTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-completed',
    title: 'Completed task',
    priority: 'normal',
    status: 'completed',
    source: 'takt',
    createdAt: DETAIL_PANEL_TEST_NOW,
    updatedAt: DETAIL_PANEL_TEST_NOW,
    ...overrides,
  }
}

export function resultSummaryForTask(
  task: TaskViewModel,
  overrides: Partial<ResultSummary> = {},
): ResultSummary {
  return {
    taskId: task.id,
    title: task.title,
    status:
      task.status === 'completed' || task.status === 'failed' || task.status === 'exceeded'
        ? task.status
        : 'completed',
    branch: 'feature/example',
    ...overrides,
  }
}

interface RenderDetailPanelOptions {
  task?: TaskViewModel
  results?: ResultSummary[]
  onOpenExecutionLog?: (task: TaskViewModel) => void
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}

export function renderDetailPanel({
  task = completedTask(),
  results = [],
  onOpenExecutionLog = vi.fn(),
  onOpenWorkDir = vi.fn(async () => {}),
}: RenderDetailPanelOptions = {}): TaskViewModel {
  render(
    <I18nProvider>
      <SkinProvider skin={defaultSkin}>
        <DetailPanel
          task={task}
          tasks={[task]}
          results={results}
          workflows={[]}
          executors={[]}
          chains={[]}
          onSelectTask={vi.fn()}
          onBack={vi.fn()}
          onCreateChain={vi.fn()}
          onMaterializeChain={vi.fn(async () => {})}
          onUnlinkChainEdge={vi.fn(async () => {})}
          onRequestRetryAction={vi.fn()}
          onOpenExecutionLog={onOpenExecutionLog}
          onOpenWorkDir={onOpenWorkDir}
        />
      </SkinProvider>
    </I18nProvider>,
  )
  return task
}
