import type { ExecutorState, TaskViewModel } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { DetailPanel } from '../detail-panel.js'

const NOW = '2026-06-02T12:00:00.000Z'

function runningTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-live',
    title: 'Live task',
    priority: 'normal',
    status: 'running',
    source: 'takt',
    createdAt: NOW,
    updatedAt: NOW,
    liveActivity: [{ at: NOW, kind: 'text', text: 'Streaming output' }],
    executionStatus: {
      lastEventAt: NOW,
      lastEventSummary: 'Streaming output',
    },
    ...overrides,
  }
}

function renderRunningDetail(task: TaskViewModel) {
  const executors: ExecutorState[] = [
    {
      id: 'codex',
      displayName: 'Codex',
      runtime: 'external',
      status: 'idle',
      activeTaskIds: [],
      updatedAt: NOW,
    },
  ]
  render(
    <I18nProvider>
      <SkinProvider skin={defaultSkin}>
        <DetailPanel
          task={task}
          tasks={[task]}
          results={[]}
          workflows={[]}
          executors={executors}
          chains={[]}
          onSelectTask={vi.fn()}
          onBack={vi.fn()}
          onCreateChain={vi.fn()}
          onMaterializeChain={vi.fn(async () => {})}
          onUnlinkChainEdge={vi.fn(async () => {})}
          onRequestRetryAction={vi.fn()}
        />
      </SkinProvider>
    </I18nProvider>,
  )
}

describe('DetailPanel live execution', () => {
  beforeEach(() => {
    installOrbitMock()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows live execution panel for running task without workflow', () => {
    renderRunningDetail(
      runningTask({
        executorAttribution: {
          taskId: 'task-live',
          executorId: 'codex',
          source: 'profile-provider',
          confidence: 'high',
        },
      }),
    )
    expect(screen.getByRole('region', { name: 'Live execution status' })).toBeTruthy()
    expect(screen.getByText('Streaming output')).toBeTruthy()
    expect(screen.getByText('0s')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
  })

  it('shows live execution panel when workflow is missing from catalog', () => {
    renderRunningDetail(
      runningTask({
        workflow: 'missing-workflow',
      }),
    )
    expect(screen.getByRole('region', { name: 'Live execution status' })).toBeTruthy()
    expect(screen.getByText(/missing-workflow/)).toBeTruthy()
  })
})
