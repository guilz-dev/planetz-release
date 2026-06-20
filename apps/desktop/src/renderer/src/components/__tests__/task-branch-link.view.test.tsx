import type { TaskViewModel } from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { TaskBranchLink } from '../task-branch-link.js'

const NOW = '2026-05-29T12:00:00.000Z'

function task(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Task',
    priority: 'normal',
    status: 'completed',
    source: 'takt',
    createdAt: NOW,
    updatedAt: NOW,
    sourceBranch: 'takt/demo-branch',
    ...overrides,
  }
}

describe('TaskBranchLink', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when branch and workDirPath are missing', () => {
    const { container } = render(
      <I18nProvider>
        <TaskBranchLink task={task({ sourceBranch: undefined })} onOpenWorkDir={vi.fn()} />
      </I18nProvider>,
    )
    expect(container.textContent).toBe('')
  })

  it('renders plain text when workDirPath is missing', () => {
    render(
      <I18nProvider>
        <TaskBranchLink task={task()} onOpenWorkDir={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByText('takt/demo-branch').tagName).toBe('SPAN')
  })

  it('shows Open folder when workDirPath is set with branch', () => {
    const onOpenWorkDir = vi.fn()
    const item = task({ workDirPath: '/tmp/wt' })
    render(
      <I18nProvider>
        <TaskBranchLink task={item} onOpenWorkDir={onOpenWorkDir} />
      </I18nProvider>,
    )
    expect(screen.getByText('Open folder')).toBeTruthy()
    expect(screen.queryByText('takt/demo-branch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Open task work folder/i }))
    expect(onOpenWorkDir).toHaveBeenCalledWith(item)
  })

  it('shows Open folder when workDirPath is set without branch', () => {
    const onOpenWorkDir = vi.fn()
    const item = task({ sourceBranch: undefined, workDirPath: '/tmp/wt' })
    render(
      <I18nProvider>
        <TaskBranchLink task={item} onOpenWorkDir={onOpenWorkDir} />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Open task work folder/i }))
    expect(onOpenWorkDir).toHaveBeenCalledWith(item)
  })
})
