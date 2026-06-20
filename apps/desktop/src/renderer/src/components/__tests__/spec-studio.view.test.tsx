import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge, createStorageMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/index.js'
import type { ChatGateway } from '../chat/chat-types.js'
import { SpecStudio } from '../spec-studio/spec-studio.js'

let gatewayForTest: ChatGateway | null = null
let latestChatViewProps: Record<string, unknown> | null = null

function defaultGetActiveComposerSessionId(threadId: string): Promise<string> {
  return Promise.resolve(`composer_${threadId}`)
}

vi.mock('../../hooks/use-chat-gateway', () => ({
  useChatGateway: () => {
    if (!gatewayForTest) throw new Error('chat gateway not configured in test')
    return gatewayForTest
  },
}))

vi.mock('../chat/chat-view', () => ({
  ChatView: (props: Record<string, unknown>) => {
    latestChatViewProps = props
    return <div data-testid="spec-studio-chat-stub" />
  },
}))

vi.mock('../../hooks/use-desktop-capabilities', () => ({
  useDesktopCapabilities: () => ({
    conversationModeEnabled: true,
    chatGateway: 'auto' as const,
    devProvidersAvailable: false,
    chatAgentEnabled: true,
    chatAgentSupportByProvider: { ollama: 'unsupported' as const },
    chatMcpEnabledByProvider: { 'claude-sdk': true, ollama: false },
  }),
  fetchDesktopCapabilities: vi.fn(),
  resetDesktopCapabilitiesForTests: vi.fn(),
}))

vi.mock('../../hooks/use-chat-session-apply', () => ({
  useChatSessionApply: () => ({
    pending: null,
    loadingPending: false,
    pendingFileCount: 0,
    applicableCount: 0,
    refreshPending: vi.fn(),
    applySelected: vi.fn(),
    getChatSessionPendingChangeFile: undefined,
  }),
}))

describe('SpecStudio', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    gatewayForTest = {
      listThreads: vi.fn(async () => []),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: [] })),
      startThread: vi.fn(async () => ({ threadId: 'thread_new' })),
      sendMessage: vi.fn(async () => ({})),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [{ value: '/repo/main', label: 'main' }],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }
    latestChatViewProps = null
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    gatewayForTest = null
  })

  it('renders workbench phase tabs and trace center when Trace is selected', async () => {
    const storage = createStorageMock()
    const listIntentLedgerByThread = vi.fn(async () => ({
      entries: [
        {
          id: 'entry-1',
          taskId: 'task-a',
          sourceRun: 'run-a',
          decisionId: 'd1',
          statement: 'Retry failed payments automatically',
          authority: 'ratified' as const,
          scopeHint: null,
          sourceDoc: null,
          sourceRunDoc: null,
          createdAt: '2026-06-10T00:00:00.000Z',
          ratifiedAt: '2026-06-10T01:00:00.000Z',
          reversibility: null,
          satisfies: null,
          deviates: null,
          unanchored: false,
          scopeConflict: false,
          adjudicationKind: null,
          adjudicationReason: null,
          promotedReqId: null,
        },
      ],
      taskIds: ['task-a'],
      trace: [
        {
          taskId: 'task-a',
          snapshot: {
            entryIds: ['entry-1'],
            capturedAt: '2026-06-14T00:00:00.000Z',
            matchBasis: 'scope_hint_recompute',
          },
          suppliedEntries: [
            {
              id: 'entry-1',
              taskId: 'task-a',
              sourceRun: 'run-a',
              decisionId: 'd1',
              statement: 'Retry failed payments automatically',
              authority: 'ratified' as const,
              scopeHint: null,
              sourceDoc: null,
              sourceRunDoc: null,
              createdAt: '2026-06-10T00:00:00.000Z',
              ratifiedAt: '2026-06-10T01:00:00.000Z',
              reversibility: null,
              satisfies: null,
              deviates: null,
              unanchored: false,
              scopeConflict: false,
              adjudicationKind: null,
              adjudicationReason: null,
              promotedReqId: null,
            },
          ],
        },
      ],
    }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-1',
                title: 'Billing recovery',
                phase: 'implementing' as const,
                adrCount: 1,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 1,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread,
          getCurrentDecidedIntent: vi.fn(async () => ({
            intent: {
              id: 'thread-1#v1',
              threadId: 'thread-1',
              version: 1,
              what: 'Recover failed payments',
              why: 'Reduce revenue loss',
              outOfScope: [],
              reason: null,
              createdAt: '2026-06-10T00:00:00.000Z',
            },
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    expect(await screen.findByText('Billing recovery')).toBeTruthy()

    fireEvent.click(screen.getByText('Billing recovery'))
    fireEvent.click(screen.getByRole('tab', { name: /implementation drift/i }))

    expect(await screen.findByText('Implementation trace')).toBeTruthy()
    expect(screen.getAllByText('task-a').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Retry failed payments automatically').length).toBeGreaterThan(0)
  })

  it('shows supply approximation when snapshot is missing', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-2',
                title: 'Auth polish',
                phase: 'clarify' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 1,
                hasDecidedIntent: false,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: ['task-pending'],
            trace: [{ taskId: 'task-pending', snapshot: null }],
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    expect(await screen.findByText('Auth polish')).toBeTruthy()

    fireEvent.click(screen.getByText('Auth polish'))
    fireEvent.click(screen.getByRole('tab', { name: /implementation drift/i }))

    expect(
      (await screen.findAllByText('Trace is an approximation (recomputed supply).')).length,
    ).toBeGreaterThan(0)
  })

  it('shows artifacts panel on Decide phase when a completed task has reports', async () => {
    const storage = createStorageMock()
    const getTaskResult = vi.fn(async (input: { taskId: string }) => ({
      taskId: input.taskId,
      status: 'ok' as const,
      reports: [
        {
          fileName: 'requirements.md',
          relativePath: 'reports/requirements.md',
          content: 'REQ-1: Retry failed payments',
        },
      ],
    }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-artifacts',
                title: 'Payment recovery',
                phase: 'decided' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 1,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: ['task-done'],
            trace: [],
          })),
          getTaskResult,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio
          tasks={[
            {
              id: 'task-done',
              title: 'Spec run',
              status: 'completed',
              priority: 'normal',
              source: 'takt',
              createdAt: '2026-06-14T00:00:00.000Z',
              updatedAt: '2026-06-14T00:00:00.000Z',
            },
          ]}
        />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Payment recovery'))

    await waitFor(() => {
      expect(getTaskResult).toHaveBeenCalledWith({ taskId: 'task-done' })
    })
    expect(await screen.findByText('REQ-1: Retry failed payments')).toBeTruthy()
    expect(screen.getByText('Latest completed task: task-done')).toBeTruthy()
  })

  it('shows Kiro phase accordion in the intent rail on Decide phase', async () => {
    const storage = createStorageMock()
    const listKiroSpecs = vi.fn(async () => ({
      specs: [
        {
          featureId: 'billing-recovery',
          specDirRel: '.kiro/specs/billing-recovery',
          parseStatus: 'ok' as const,
          approvals: {
            requirements: { approved: true },
            design: { approved: false },
          },
        },
      ],
    }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-kiro',
                title: 'Billing Kiro',
                phase: 'implementing' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 0,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: [],
            trace: [],
          })),
          listKiroSpecs,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Billing Kiro'))

    await waitFor(() => {
      expect(listKiroSpecs).toHaveBeenCalled()
    })
    expect(await screen.findByText('billing-recovery')).toBeTruthy()
  })

  it('opens trace automatically when a drift thread is selected', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-drift',
                title: 'Drift case',
                phase: 'drift' as const,
                adrCount: 0,
                pendingCount: 1,
                driftCount: 1,
                taskCount: 1,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: ['task-drift'],
            trace: [],
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Drift case'))
    expect(await screen.findByText('Implementation trace')).toBeTruthy()
    expect(screen.getByText('1 drift item(s) need adjudication')).toBeTruthy()
    expect(screen.queryByText('Drift was observed on this spec. Open Trace to review.')).toBeNull()
  })

  it('refreshes thread summaries after rail adjudication so banner and stepper stay current', async () => {
    let driftResolved = false
    const driftEntry = {
      id: 'task-drift:run-a:obs-1',
      taskId: 'task-drift',
      sourceRun: 'run-a',
      decisionId: 'obs-1',
      statement: 'Observed behavior diverged from spec',
      authority: 'observed' as const,
      scopeHint: null,
      sourceDoc: null,
      sourceRunDoc: 'decisions.json',
      createdAt: '2026-06-10T00:00:00.000Z',
      ratifiedAt: null,
      reversibility: 'cheap' as const,
      satisfies: null,
      deviates: ['REQ-1'],
      unanchored: true,
      scopeConflict: false,
      adjudicationKind: null,
      adjudicationReason: null,
      promotedReqId: null,
    }
    const listSpecThreadSummaries = vi.fn(async () => ({
      summaries: [
        {
          threadId: 'thread-drift',
          title: 'Drift case',
          phase: (driftResolved ? 'implementing' : 'drift') as 'implementing' | 'drift',
          adrCount: 0,
          pendingCount: driftResolved ? 0 : 1,
          driftCount: driftResolved ? 0 : 1,
          taskCount: 1,
          hasDecidedIntent: true,
          updatedAt: '2026-06-14T00:00:00.000Z',
        },
      ],
    }))
    const adoptIntentLedgerEntry = vi.fn(async () => {
      driftResolved = true
      return { ok: true as const }
    })
    const listIntentLedgerByThread = vi.fn(async () => ({
      entries: driftResolved
        ? [{ ...driftEntry, ratifiedAt: '2026-06-14T01:00:00.000Z', promotedReqId: 'REQ-1' }]
        : [driftEntry],
      taskIds: ['task-drift'],
      trace: [],
    }))

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries,
          listIntentLedgerByThread,
          adoptIntentLedgerEntry,
          getCurrentDecidedIntent: vi.fn(async () => ({
            intent: {
              id: 'thread-drift#v1',
              threadId: 'thread-drift',
              version: 1,
              what: 'Ship billing recovery',
              why: 'Reduce churn',
              outOfScope: [],
              reason: null,
              createdAt: '2026-06-10T00:00:00.000Z',
            },
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Drift case'))
    expect(await screen.findByText('1 drift item(s) need adjudication')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Adopt' }))

    await waitFor(() => {
      expect(adoptIntentLedgerEntry).toHaveBeenCalledWith({ entryId: driftEntry.id })
    })
    await waitFor(() => {
      expect(listSpecThreadSummaries.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    await waitFor(() => {
      expect(screen.queryByText('1 drift item(s) need adjudication')).toBeNull()
    })
  })

  it('shows next-step CTA to open trace when implementing without drift', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-impl',
                title: 'Shipping flow',
                phase: 'implementing' as const,
                adrCount: 1,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 2,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: ['task-a', 'task-b'],
            trace: [],
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Shipping flow'))
    expect(
      await screen.findByText('You can verify implementation against your decisions.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Trace' }))
    expect(await screen.findByText('Implementation trace')).toBeTruthy()
  })

  it('expands trace rail section when trace workbench is active', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-trace-rail',
                title: 'Trace rail',
                phase: 'implementing' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 1,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: ['task-rail'],
            trace: [{ taskId: 'task-rail', snapshot: null }],
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Trace rail'))
    fireEvent.click(screen.getByRole('tab', { name: /implementation drift/i }))
    await waitFor(() => {
      expect(screen.getAllByText('task-rail').length).toBeGreaterThan(0)
    })
    expect(
      screen.getAllByText('Trace is an approximation (recomputed supply).').length,
    ).toBeGreaterThan(0)
  })

  it('shows guided empty state when trace has no tasks', async () => {
    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-empty-trace',
                title: 'Empty trace',
                phase: 'decided' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 0,
                hasDecidedIntent: true,
                updatedAt: '2026-06-14T00:00:00.000Z',
              },
            ],
          })),
          listIntentLedgerByThread: vi.fn(async () => ({
            entries: [],
            taskIds: [],
            trace: [],
          })),
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByText('Empty trace'))
    fireEvent.click(screen.getByRole('tab', { name: /implementation drift/i }))

    expect(await screen.findByText('Nothing to trace yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Go to Decide' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Decide' }))
    expect(await screen.findByText('Artifacts')).toBeTruthy()
  })

  it('generates intent draft once when stream settles with a new assistant turn', async () => {
    const storage = createStorageMock()
    const generateIntentDraft = vi.fn(async () => ({
      draft: {
        threadId: 'thread-intent',
        autoGenerate: true,
        what: 'Confirm payment retries',
        why: 'Reduce failed checkout sessions',
        outOfScopeText: '',
        sourceTurnId: 'turn-assistant-2',
        generatedAt: '2026-06-16T00:00:00.000Z',
        touchedByUser: false,
        basedOnIntentVersion: null,
      },
    }))
    const getIntentDraft = vi.fn(async () => ({
      draft: {
        threadId: 'thread-intent',
        autoGenerate: true,
        what: '',
        why: '',
        outOfScopeText: '',
        touchedByUser: false,
        basedOnIntentVersion: null,
      },
    }))

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-intent',
                title: 'Intent auto draft',
                phase: 'clarify' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 0,
                hasDecidedIntent: false,
                updatedAt: '2026-06-16T00:00:00.000Z',
              },
            ],
          })),
          getIntentDraft,
          generateIntentDraft,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )
    fireEvent.click(await screen.findByText('Intent auto draft'))
    await waitFor(() => {
      expect(getIntentDraft).toHaveBeenCalledWith({ threadId: 'thread-intent' })
    })

    const onThreadStreamSettled = latestChatViewProps?.onThreadStreamSettled as
      | ((input: { threadId: string | null; latestAssistantTurnId: string | null }) => void)
      | undefined
    expect(onThreadStreamSettled).toBeTypeOf('function')

    onThreadStreamSettled?.({
      threadId: 'thread-intent',
      latestAssistantTurnId: 'turn-assistant-2',
    })
    onThreadStreamSettled?.({
      threadId: 'thread-intent',
      latestAssistantTurnId: 'turn-assistant-2',
    })

    await waitFor(() => {
      expect(generateIntentDraft).toHaveBeenCalledTimes(1)
      expect(generateIntentDraft).toHaveBeenCalledWith({
        threadId: 'thread-intent',
        sourceTurnId: 'turn-assistant-2',
      })
    })
  })

  it('does not generate intent draft when auto-generate is disabled', async () => {
    const storage = createStorageMock()
    const generateIntentDraft = vi.fn(async () => ({ draft: null }))
    const getIntentDraft = vi.fn(async () => ({
      draft: {
        threadId: 'thread-manual',
        autoGenerate: false,
        what: '',
        why: '',
        outOfScopeText: '',
        touchedByUser: false,
        basedOnIntentVersion: null,
      },
    }))

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({
            summaries: [
              {
                threadId: 'thread-manual',
                title: 'Manual draft thread',
                phase: 'clarify' as const,
                adrCount: 0,
                pendingCount: 0,
                driftCount: 0,
                taskCount: 0,
                hasDecidedIntent: false,
                updatedAt: '2026-06-16T00:00:00.000Z',
              },
            ],
          })),
          getIntentDraft,
          generateIntentDraft,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )
    fireEvent.click(await screen.findByText('Manual draft thread'))
    await waitFor(() => {
      expect(getIntentDraft).toHaveBeenCalledWith({ threadId: 'thread-manual' })
    })

    const onThreadStreamSettled = latestChatViewProps?.onThreadStreamSettled as
      | ((input: { threadId: string | null; latestAssistantTurnId: string | null }) => void)
      | undefined
    expect(onThreadStreamSettled).toBeTypeOf('function')
    onThreadStreamSettled?.({
      threadId: 'thread-manual',
      latestAssistantTurnId: 'turn-assistant-9',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(generateIntentDraft).not.toHaveBeenCalled()
  })

  it('shows workspace-wide decisions link when no thread is selected', async () => {
    const storage = createStorageMock()
    const getIntentLedgerSummary = vi.fn(async () => ({
      window: 'all' as const,
      ingestedAssumedCount: 0,
      pendingCount: 3,
      ratifiedCount: 0,
      reversedCount: 0,
      adjudicationRate: null,
      scopeConflictCount: 0,
      unanchoredCount: 1,
      unanchoredRate: null,
      adjudicationLatencyP50Ms: null,
      ratifyRatio: null,
      reverseRatio: null,
      adoptCount: 0,
      fixCount: 0,
    }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({
          listSpecThreadSummaries: vi.fn(async () => ({ summaries: [] })),
          getIntentLedgerSummary,
        }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SpecStudio />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(getIntentLedgerSummary).toHaveBeenCalled()
    })
    expect(screen.getByText('Select or start a spec thread.')).toBeTruthy()
    expect(screen.getByText('Pending adjudication: 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review all pending decisions' })).toBeTruthy()
  })
})
