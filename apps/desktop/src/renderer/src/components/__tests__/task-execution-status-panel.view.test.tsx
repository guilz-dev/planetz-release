import { ACTIVITY_ACTIVE_MS, ACTIVITY_QUIET_MS, type TaskViewModel } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { TaskExecutionStatusPanel } from '../task-execution-status-panel.js'

const NOW = '2026-06-02T12:00:00.000Z'

function runningTask(overrides: Partial<TaskViewModel> = {}): TaskViewModel {
  return {
    id: 'task-1',
    title: 'Running',
    priority: 'normal',
    status: 'running',
    source: 'takt',
    createdAt: NOW,
    updatedAt: NOW,
    executionStatus: {
      runId: 'run-dir:sess',
      workflowStep: 'implement',
      lastEventAt: NOW,
      lastEventSummary: 'Running grep',
    },
    liveActivity: [{ at: NOW, kind: 'tool_use', text: 'Running grep' }],
    ...overrides,
  }
}

describe('TaskExecutionStatusPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows activity badge, run id, and live feed without duplicating summary', () => {
    render(
      <I18nProvider>
        <TaskExecutionStatusPanel task={runningTask()} />
      </I18nProvider>,
    )

    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText(/run run-dir:sess/)).toBeTruthy()
    expect(screen.getByRole('log', { name: 'Live activity log' })).toBeTruthy()
    expect(screen.getAllByText('Running grep').length).toBe(1)
  })

  it('shows live feed from workflow step activities when task liveActivity is missing', () => {
    render(
      <I18nProvider>
        <TaskExecutionStatusPanel
          task={runningTask({
            liveActivity: undefined,
            executionStatus: {
              runId: 'run-dir:sess',
              workflowStep: 'plan',
              phase: 'report',
            },
            workflowStepActivities: [
              {
                stepName: 'plan',
                history: [
                  { at: NOW, kind: 'phase', text: '[phase:report] started' },
                  { at: NOW, kind: 'message', text: 'Planner output from step feed' },
                ],
                latest: { at: NOW, kind: 'message', text: 'Planner output from step feed' },
              },
            ],
          })}
        />
      </I18nProvider>,
    )

    expect(screen.getByRole('log', { name: 'Live activity log' })).toBeTruthy()
    expect(screen.getByText('Planner output from step feed')).toBeTruthy()
    expect(screen.queryByText('Waiting for run log events…')).toBeNull()
  })

  it('shows unknown badge and waiting copy when feed is empty', () => {
    render(
      <I18nProvider>
        <TaskExecutionStatusPanel
          task={runningTask({
            executionStatus: undefined,
            liveActivity: undefined,
          })}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.getByText('Waiting for run log events…')).toBeTruthy()
  })

  it('shows quiet and stale activity badges as lastEventAt ages', () => {
    const quietAt = new Date(Date.parse(NOW) - ACTIVITY_ACTIVE_MS - 5_000).toISOString()
    const staleAt = new Date(Date.parse(NOW) - ACTIVITY_QUIET_MS - 1_000).toISOString()

    const { rerender } = render(
      <I18nProvider>
        <TaskExecutionStatusPanel
          task={runningTask({
            executionStatus: {
              lastEventAt: quietAt,
              lastEventSummary: 'Older event',
            },
          })}
        />
      </I18nProvider>,
    )
    expect(screen.getByText('Quiet')).toBeTruthy()

    rerender(
      <I18nProvider>
        <TaskExecutionStatusPanel
          task={runningTask({
            executionStatus: {
              lastEventAt: staleAt,
              lastEventSummary: 'Stale event',
            },
          })}
        />
      </I18nProvider>,
    )
    expect(screen.getByText('Stale')).toBeTruthy()
  })

  it('shows inner step and phase rows when execution status includes them', () => {
    render(
      <I18nProvider>
        <TaskExecutionStatusPanel
          task={runningTask({
            executionStatus: {
              runId: 'run-dir:sess',
              workflowStep: 'implement',
              innerStep: 'write_tests',
              phase: 'execute',
              lastEventAt: NOW,
              lastEventSummary: 'Running grep',
            },
          })}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Inner step')).toBeTruthy()
    expect(screen.getByText('write_tests')).toBeTruthy()
    expect(screen.getByText('Phase')).toBeTruthy()
    expect(screen.getByText('execute')).toBeTruthy()
  })
})
