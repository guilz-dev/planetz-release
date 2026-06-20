import type { TaskViewModel } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context'
import { defaultSkin } from '../../skins/default-skin.js'
import { useAppStore } from '../../store/app-store.js'
import { TaskLane } from '../task-lane.js'

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

function renderLane(
  onStopRunning?: (task: TaskViewModel) => Promise<void>,
  tasks: TaskViewModel[] = [runningTask()],
) {
  render(
    <I18nProvider>
      <SkinProvider skin={defaultSkin}>
        <TaskLane
          tasks={tasks}
          retries={[]}
          results={[]}
          executors={[]}
          workflows={[]}
          skin={defaultSkin}
          onSelect={vi.fn()}
          onRequestRetryAction={vi.fn()}
          onStopRunning={onStopRunning}
        />
      </SkinProvider>
    </I18nProvider>,
  )
}

describe('TaskLane manta swim strip', () => {
  afterEach(() => {
    cleanup()
    useAppStore.setState({ counterPackEnabled: false })
  })

  it('hides swim strip when manta mode is off', () => {
    useAppStore.setState({ counterPackEnabled: false })
    renderLane(vi.fn(async () => {}))
    expect(screen.queryByRole('group', { name: 'No mantas swimming' })).toBeNull()
  })

  it('shows idle swim strip when manta mode is on and nothing is running', () => {
    useAppStore.setState({ counterPackEnabled: true })
    renderLane(
      vi.fn(async () => {}),
      [],
    )
    expect(screen.getByRole('group', { name: 'No mantas swimming' })).toBeTruthy()
  })

  it('shows active swim strip when manta mode is on and tasks are running', () => {
    useAppStore.setState({ counterPackEnabled: true })
    renderLane(
      vi.fn(async () => {}),
      [runningTask()],
    )
    expect(screen.getByRole('group', { name: 'Active squad: 1 swimming' })).toBeTruthy()
  })
})

describe('TaskLane stop action', () => {
  afterEach(() => {
    cleanup()
    useAppStore.setState({ counterPackEnabled: false })
  })

  it('shows Stop for running task when onStopRunning is provided', () => {
    renderLane(vi.fn(async () => {}))
    expect(screen.getByRole('button', { name: 'Stop this running task' })).toBeTruthy()
  })

  it('hides Stop when onStopRunning is omitted', () => {
    renderLane(undefined)
    expect(screen.queryByRole('button', { name: 'Stop this running task' })).toBeNull()
  })
})
