import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { ExecutionSummaryView } from '../execution-summary-view.js'

function renderView(overrides: Parameters<typeof installOrbitMock>[0] = {}) {
  installOrbitMock(overrides)
  useAppStore.setState({ uiLanguage: 'en', stateRevision: 1 })
  return render(
    <I18nProvider>
      <ExecutionSummaryView />
    </I18nProvider>,
  )
}

function ledgerSummary(
  overrides: Partial<
    Awaited<ReturnType<NonNullable<typeof window.orbit.getIntentLedgerSummary>>>
  > = {},
) {
  return {
    window: '7d' as const,
    ingestedAssumedCount: 0,
    pendingCount: 0,
    ratifiedCount: 0,
    reversedCount: 0,
    adjudicationRate: null,
    scopeConflictCount: 0,
    unanchoredCount: 0,
    unanchoredRate: null,
    adjudicationLatencyP50Ms: null,
    ratifyRatio: null,
    reverseRatio: null,
    adoptCount: 0,
    fixCount: 0,
    ...overrides,
  }
}

describe('ExecutionSummaryView', () => {
  beforeEach(() => {
    resetAppStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('loads summary via orbit bridge', async () => {
    const getExecutionSummary = vi.fn(async () => ({
      window: '7d' as const,
      total: 2,
      completed: 1,
      failureCount: 1,
      successRate: 50,
      byStatus: [
        { status: 'completed' as const, count: 1 },
        { status: 'failed' as const, count: 1 },
        { status: 'exceeded' as const, count: 0 },
      ],
      byExecutor: [],
      byWorkflow: [],
    }))
    const getIntentLedgerSummary = vi.fn(async () =>
      ledgerSummary({
        ingestedAssumedCount: 4,
        pendingCount: 2,
        ratifiedCount: 1,
        reversedCount: 1,
        adjudicationRate: 0.5,
        scopeConflictCount: 1,
      }),
    )
    renderView({ getExecutionSummary, getIntentLedgerSummary })

    await waitFor(() => {
      expect(getExecutionSummary).toHaveBeenCalled()
      expect(getIntentLedgerSummary).toHaveBeenCalled()
    })
    expect(screen.getByText('Terminal tasks')).toBeTruthy()
    expect(screen.getByText('Decisions (intent ledger)')).toBeTruthy()
    expect(screen.getByText('Assumed ingested')).toBeTruthy()
    expect(screen.getByText('Adjudication rate')).toBeTruthy()
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1)
  })

  it('shows unanchored pending count in decisions KPI section', async () => {
    const getIntentLedgerSummary = vi.fn(async () =>
      ledgerSummary({
        ingestedAssumedCount: 3,
        pendingCount: 2,
        ratifiedCount: 1,
        reversedCount: 0,
        adjudicationRate: 1 / 3,
        unanchoredCount: 2,
      }),
    )
    renderView({ getIntentLedgerSummary })

    await waitFor(() => {
      expect(getIntentLedgerSummary).toHaveBeenCalled()
    })
    expect(screen.getByText('Unanchored (pending)')).toBeTruthy()
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
  })

  it('shows theater metrics in decisions KPI section', async () => {
    const getIntentLedgerSummary = vi.fn(async () =>
      ledgerSummary({
        ingestedAssumedCount: 4,
        pendingCount: 1,
        ratifiedCount: 3,
        reversedCount: 1,
        adjudicationRate: 1,
        unanchoredRate: 0.25,
        adjudicationLatencyP50Ms: 3_600_000,
        ratifyRatio: 0.75,
        reverseRatio: 0.25,
      }),
    )
    renderView({ getIntentLedgerSummary })

    await waitFor(() => {
      expect(getIntentLedgerSummary).toHaveBeenCalled()
    })
    expect(screen.getByText('Unanchored rate')).toBeTruthy()
    expect(screen.getByText('Approve ratio')).toBeTruthy()
    expect(screen.getByText('Reject ratio')).toBeTruthy()
    expect(screen.getByText('Adjudication latency (p50)')).toBeTruthy()
    expect(screen.getByText('1h')).toBeTruthy()
    expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(1)
  })

  it('shows capability banner when getExecutionSummary is missing', async () => {
    renderView({ getExecutionSummary: undefined as never })

    expect(screen.getByText('Execution summary')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/getExecutionSummary/)).toBeTruthy()
  })

  it('shows error alert when IPC fails', async () => {
    const getExecutionSummary = vi.fn(() => Promise.reject(new Error('IPC failed')))
    renderView({ getExecutionSummary })

    await waitFor(() => {
      expect(screen.getByText('IPC failed')).toBeTruthy()
    })
    expect(getExecutionSummary).toHaveBeenCalled()
  })
})
