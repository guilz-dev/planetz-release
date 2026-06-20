import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { ExecutionLogView } from '../execution-log-view.js'

function renderView(overrides: Parameters<typeof installOrbitMock>[0] = {}) {
  installOrbitMock(overrides)
  useAppStore.setState({ uiLanguage: 'en', stateRevision: 1 })
  return render(
    <I18nProvider>
      <ExecutionLogView executors={[]} />
    </I18nProvider>,
  )
}

describe('ExecutionLogView', () => {
  beforeEach(() => {
    resetAppStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('loads log via orbit bridge', async () => {
    const listExecutionLog = vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 0,
      hasMore: false,
    }))
    renderView({ listExecutionLog })

    await waitFor(() => {
      expect(listExecutionLog).toHaveBeenCalled()
    })
    expect(screen.getByText('Execution log')).toBeTruthy()
  })

  it('shows capability banner when listExecutionLog is missing', () => {
    renderView({ listExecutionLog: undefined as never })

    expect(screen.getByText('Execution log')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/listExecutionLog/)).toBeTruthy()
  })

  it('applies execution log preset from the app store', async () => {
    const listExecutionLog = vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 0,
      hasMore: false,
    }))
    installOrbitMock({ listExecutionLog })
    useAppStore.setState({
      uiLanguage: 'en',
      stateRevision: 1,
      executionLogPreset: {
        keyword: 'implement-auth-core',
        taskStatus: 'all',
        executorId: 'all',
      },
    })
    render(
      <I18nProvider>
        <ExecutionLogView executors={[]} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(listExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'implement-auth-core' }),
      )
    })
    expect(useAppStore.getState().executionLogPreset).toBeNull()
  })

  it('shows emptyNoRuns when rawTotalInWindow is omitted and total is zero', async () => {
    const listExecutionLog = vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      hasMore: false,
    }))
    renderView({ listExecutionLog })

    await waitFor(() => {
      expect(screen.getByText(/No run events yet/)).toBeTruthy()
    })
  })

  it('shows emptyFiltered when raw events exist but filters exclude all', async () => {
    const listExecutionLog = vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 3,
      hasMore: false,
    }))
    renderView({ listExecutionLog })

    await waitFor(() => {
      expect(screen.getByText(/No events match your filters/)).toBeTruthy()
    })
  })

  it('applies runId preset to listExecutionLog query', async () => {
    const listExecutionLog = vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 0,
      hasMore: false,
    }))
    installOrbitMock({ listExecutionLog })
    useAppStore.setState({
      uiLanguage: 'en',
      stateRevision: 1,
      executionLogPreset: {
        runId: 'run-fail:session-1',
        window: 'all',
        taskStatus: 'failed',
        executorId: 'all',
      },
    })
    render(
      <I18nProvider>
        <ExecutionLogView executors={[]} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(listExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-fail:session-1', window: 'all' }),
      )
    })
  })

  it('loads more rows when Load more is clicked', async () => {
    const listExecutionLog = vi.fn(async (query?: { cursor?: string }) => {
      if (query?.cursor) {
        return {
          records: [
            {
              id: 'run-b:2026-01-02T00:00:00.000Z:log',
              at: '2026-01-02T00:00:00.000Z',
              runId: 'run-b:session-1',
              source: 'planetz' as const,
              eventType: 'log' as const,
              message: 'page-2',
            },
          ],
          total: 2,
          truncated: false,
          rawTotalInWindow: 2,
          hasMore: false,
          nextCursor: undefined,
        }
      }
      return {
        records: [
          {
            id: 'run-a:2026-01-01T00:00:00.000Z:log',
            at: '2026-01-01T00:00:00.000Z',
            runId: 'run-a:session-1',
            source: 'planetz' as const,
            eventType: 'log' as const,
            message: 'page-1',
          },
        ],
        total: 2,
        truncated: true,
        rawTotalInWindow: 2,
        hasMore: true,
        nextCursor: 'cursor-page-1',
      }
    })
    renderView({ listExecutionLog })

    await waitFor(() => {
      expect(screen.getByText('page-1')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => {
      expect(listExecutionLog).toHaveBeenCalledTimes(2)
      expect(screen.getByText('page-2')).toBeTruthy()
    })
  })

  it('shows error alert when IPC fails', async () => {
    const listExecutionLog = vi.fn(() => Promise.reject(new Error('log IPC failed')))
    renderView({ listExecutionLog })

    await waitFor(() => {
      expect(screen.getByText('log IPC failed')).toBeTruthy()
    })
    expect(listExecutionLog).toHaveBeenCalled()
  })
})
