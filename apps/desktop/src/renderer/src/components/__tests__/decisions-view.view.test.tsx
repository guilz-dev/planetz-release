import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge, createStorageMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/index.js'
import { useAppStore } from '../../store/app-store.js'
import { DecisionsView } from '../decisions-view.js'

describe('DecisionsView', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useAppStore.setState({ decisionsExpensiveOnly: false })
  })

  it('renders pending assumptions and ratifies an entry', async () => {
    const ratifyIntentLedgerEntry = vi.fn(async () => ({ ok: true as const }))
    const listPendingIntentLedger = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [
          {
            id: 'task-1:run-a:d1',
            taskId: 'task-1',
            sourceRun: 'run-a',
            decisionId: 'd1',
            statement: 'Discard drafts on session switch',
            authority: 'assumed',
            scopeHint: 'chat',
            sourceDoc: null,
            sourceRunDoc: 'decisions.json',
            createdAt: '2026-06-10T00:00:00.000Z',
            ratifiedAt: null,
            reversibility: 'expensive',
          },
        ],
      })
      .mockResolvedValue({ entries: [] })

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listPendingIntentLedger,
          ratifyIntentLedgerEntry,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <DecisionsView
          requestConfirm={vi.fn(async () => true)}
          onEnqueueTask={vi.fn(async () => undefined)}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Discard drafts on session switch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(ratifyIntentLedgerEntry).toHaveBeenCalledWith({ entryId: 'task-1:run-a:d1' })
  })

  it('shows unanchored badge and trace fields on decision cards', async () => {
    const listPendingIntentLedger = vi.fn().mockResolvedValue({
      entries: [
        {
          id: 'task-1:run-a:unanchored',
          taskId: 'task-1',
          sourceRun: 'run-a',
          decisionId: 'unanchored',
          statement: 'Floating assumption',
          authority: 'assumed',
          scopeHint: null,
          sourceDoc: null,
          sourceRunDoc: 'decisions.json',
          createdAt: '2026-06-10T00:00:00.000Z',
          ratifiedAt: null,
          reversibility: 'expensive',
          unanchored: true,
        },
        {
          id: 'task-1:run-a:anchored',
          taskId: 'task-1',
          sourceRun: 'run-a',
          decisionId: 'anchored',
          statement: 'Traced assumption',
          authority: 'assumed',
          scopeHint: null,
          sourceDoc: 'design.md §API',
          sourceRunDoc: 'decisions.json',
          createdAt: '2026-06-10T00:00:00.000Z',
          ratifiedAt: null,
          reversibility: 'cheap',
          satisfies: ['REQ-auth-1'],
          deviates: ['DSN-api-2'],
          unanchored: false,
        },
      ],
    })

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({ listPendingIntentLedger }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <DecisionsView
          requestConfirm={vi.fn(async () => true)}
          onEnqueueTask={vi.fn(async () => undefined)}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Floating assumption')).toBeTruthy()
    expect(screen.getByText('Unanchored')).toBeTruthy()
    const floatingCard = screen.getByText('Floating assumption').closest('article')
    expect(floatingCard).toBeTruthy()
    if (floatingCard) {
      const scoped = within(floatingCard)
      expect(scoped.queryByRole('button', { name: 'Approve' })).toBeNull()
      expect(scoped.queryByRole('button', { name: 'Reject' })).toBeNull()
      expect(scoped.getByRole('button', { name: 'Adopt' })).toBeTruthy()
      expect(scoped.getByRole('button', { name: 'Fix' })).toBeTruthy()
    }
    expect(screen.getByText('Traced assumption')).toBeTruthy()
    const tracedCard = screen.getByText('Traced assumption').closest('article')
    expect(tracedCard).toBeTruthy()
    if (tracedCard) {
      expect(within(tracedCard).getByRole('button', { name: 'Approve' })).toBeTruthy()
    }
    expect(screen.getByText('REQ-auth-1')).toBeTruthy()
    expect(screen.getByText('DSN-api-2')).toBeTruthy()
    expect(screen.getByText('design.md §API')).toBeTruthy()
  })

  it('shows observed entries without ratify/reverse actions', async () => {
    const listPendingIntentLedger = vi.fn().mockResolvedValue({
      entries: [
        {
          id: 'task-1:run-a:drift-auth',
          taskId: 'task-1',
          sourceRun: 'run-a',
          decisionId: 'drift-auth',
          statement: 'Auth handler lacks REQ trace',
          authority: 'observed',
          scopeHint: null,
          sourceDoc: 'src/auth.ts:42',
          sourceRunDoc: 'observation.json',
          createdAt: '2026-06-10T00:00:00.000Z',
          ratifiedAt: null,
          reversibility: null,
          unanchored: true,
        },
      ],
    })

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({ listPendingIntentLedger }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <DecisionsView
          requestConfirm={vi.fn(async () => true)}
          onEnqueueTask={vi.fn(async () => undefined)}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Auth handler lacks REQ trace')).toBeTruthy()
    expect(screen.getByText('Observed')).toBeTruthy()
    expect(screen.getByText(/Evidence|根拠/)).toBeTruthy()
    expect(screen.getByText('src/auth.ts:42')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Adopt' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fix' })).toBeTruthy()
  })

  it('asks before enqueueing a fix task on reverse', async () => {
    const reverseIntentLedgerEntry = vi.fn(async () => ({ ok: true as const }))
    const onEnqueueTask = vi.fn(async () => undefined)
    const requestConfirm = vi.fn(async () => true)
    const listPendingIntentLedger = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [
          {
            id: 'task-1:run-a:d1',
            taskId: 'task-1',
            sourceRun: 'run-a',
            decisionId: 'd1',
            statement: 'Discard drafts on session switch',
            authority: 'assumed',
            scopeHint: null,
            sourceDoc: null,
            sourceRunDoc: null,
            createdAt: '2026-06-10T00:00:00.000Z',
            ratifiedAt: null,
            reversibility: 'expensive',
          },
        ],
      })
      .mockResolvedValue({ entries: [] })

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listPendingIntentLedger,
          reverseIntentLedgerEntry,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <DecisionsView requestConfirm={requestConfirm} onEnqueueTask={onEnqueueTask} />
      </I18nProvider>,
    )

    expect(await screen.findByText('Discard drafts on session switch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => {
      expect(reverseIntentLedgerEntry).toHaveBeenCalledWith({ entryId: 'task-1:run-a:d1' })
      expect(requestConfirm).toHaveBeenCalled()
      expect(onEnqueueTask).toHaveBeenCalled()
    })
  })

  it('asks before recording fix adjudication on observed entries', async () => {
    const fixIntentLedgerEntry = vi.fn(async () => ({ ok: true as const }))
    const onEnqueueTask = vi.fn(async () => undefined)
    const requestConfirm = vi.fn(async () => true)
    const listPendingIntentLedger = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [
          {
            id: 'task-1:run-a:drift-auth',
            taskId: 'task-1',
            sourceRun: 'run-a',
            decisionId: 'drift-auth',
            statement: 'Auth handler lacks REQ trace',
            authority: 'observed',
            scopeHint: null,
            sourceDoc: 'src/auth.ts:42',
            sourceRunDoc: 'observation.json',
            createdAt: '2026-06-10T00:00:00.000Z',
            ratifiedAt: null,
            reversibility: null,
            unanchored: true,
          },
        ],
      })
      .mockResolvedValue({ entries: [] })

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listPendingIntentLedger,
          fixIntentLedgerEntry,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <DecisionsView requestConfirm={requestConfirm} onEnqueueTask={onEnqueueTask} />
      </I18nProvider>,
    )

    expect(await screen.findByText('Auth handler lacks REQ trace')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    await waitFor(() => {
      expect(requestConfirm).toHaveBeenCalled()
      expect(fixIntentLedgerEntry).toHaveBeenCalledWith({ entryId: 'task-1:run-a:drift-auth' })
      expect(onEnqueueTask).toHaveBeenCalled()
    })
  })
})
