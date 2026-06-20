import type { TaskViewModel } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { DetailPanel } from '../detail-panel.js'

const NOW = '2026-05-29T12:00:00.000Z'

function pendingTask(): TaskViewModel {
  return {
    id: 'task-pending',
    title: 'Pending task',
    priority: 'normal',
    status: 'pending',
    source: 'takt',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function renderDetail(onDeletePending?: (task: TaskViewModel) => Promise<void>) {
  const task = pendingTask()
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
          onDeletePending={onDeletePending}
        />
      </SkinProvider>
    </I18nProvider>,
  )
}

describe('DetailPanel delete action', () => {
  beforeEach(() => {
    installOrbitMock()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows Delete for pending task when onDeletePending is provided', () => {
    renderDetail(vi.fn(async () => {}))
    expect(screen.getByRole('button', { name: 'Delete this pending task' })).toBeTruthy()
  })

  it('hides Delete when onDeletePending is omitted', () => {
    renderDetail(undefined)
    expect(screen.queryByRole('button', { name: 'Delete this pending task' })).toBeNull()
  })
})
