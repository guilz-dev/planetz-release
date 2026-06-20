import type { TaskViewModel } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { DetailPanel } from '../detail-panel.js'

const NOW = '2026-05-29T12:00:00.000Z'

function runningTask(): TaskViewModel {
  return {
    id: 'task-running',
    title: 'Running task',
    priority: 'normal',
    status: 'running',
    source: 'takt',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function renderDetail(onStopRunning?: (task: TaskViewModel) => Promise<void>) {
  const task = runningTask()
  render(
    <I18nProvider>
      <SkinProvider skin={defaultSkin}>
        <DetailPanel
          task={task}
          tasks={[task]}
          results={[]}
          workflows={[]}
          executors={[]}
          chains={[]}
          onSelectTask={vi.fn()}
          onBack={vi.fn()}
          onCreateChain={vi.fn()}
          onMaterializeChain={vi.fn(async () => {})}
          onUnlinkChainEdge={vi.fn(async () => {})}
          onRequestRetryAction={vi.fn()}
          onStopRunning={onStopRunning}
        />
      </SkinProvider>
    </I18nProvider>,
  )
}

describe('DetailPanel stop action', () => {
  beforeEach(() => {
    installOrbitMock()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows Stop for running task when onStopRunning is provided', () => {
    renderDetail(vi.fn(async () => {}))
    expect(screen.getByRole('button', { name: 'Stop this running task' })).toBeTruthy()
  })

  it('hides Stop when onStopRunning is omitted', () => {
    renderDetail(undefined)
    expect(screen.queryByRole('button', { name: 'Stop this running task' })).toBeNull()
  })
})
