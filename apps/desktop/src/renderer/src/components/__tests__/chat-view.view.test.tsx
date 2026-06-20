import { CHAT_TO_TASK_HANDOFF_MAX_CHARS } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import type { ChatGateway } from '../chat/chat-types.js'
import { ChatView } from '../chat/chat-view.js'

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  let reject: (reason?: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let gatewayForTest: ChatGateway | null = null

function defaultGetActiveComposerSessionId(threadId: string): Promise<string> {
  return Promise.resolve(`composer_${threadId}`)
}

vi.mock('../../hooks/use-chat-gateway', () => ({
  useChatGateway: () => {
    if (!gatewayForTest) throw new Error('chat gateway not configured in test')
    return gatewayForTest
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

function renderChatView(overrides: Partial<ComponentProps<typeof ChatView>> = {}) {
  return render(
    <I18nProvider>
      <ChatView currentWorkspacePath="/repo/main" emptyCopyVariant="default" {...overrides} />
    </I18nProvider>,
  )
}

describe('ChatView', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    resetAppStore()
    useAppStore.setState({
      uiLanguage: 'en',
      chatMode: 'interactive',
      chatSidebarCollapsed: false,
      activeView: 'spec-studio',
    })
    gatewayForTest = null
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    gatewayForTest = null
  })

  it('keeps current thread view when another thread send resolves later', async () => {
    const sendDeferred = createDeferred<void>()
    let useAfterReplyForA = false

    const threadAInitial = [
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Thread A initial message',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]
    const threadAAfterReply = [
      ...threadAInitial,
      {
        id: 'a2',
        role: 'assistant' as const,
        content: 'Thread A reply after send',
        createdAt: '2026-06-01T00:01:00.000Z',
      },
    ]
    const threadB = [
      {
        id: 'b1',
        role: 'assistant' as const,
        content: 'Thread B selected message',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]

    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_a',
          title: 'Thread A',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
        {
          id: 'thread_b',
          title: 'Thread B',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: false,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async (threadId: string) => {
        if (threadId === 'thread_a') {
          return { turns: useAfterReplyForA ? threadAAfterReply : threadAInitial }
        }
        if (threadId === 'thread_b') return { turns: threadB }
        return { turns: [] }
      }),
      startThread: vi.fn(async () => ({ threadId: 'thread_new' })),
      sendMessage: vi.fn(async () => {
        await sendDeferred.promise
        useAfterReplyForA = true
        return {}
      }),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [{ value: '/repo/main', label: 'main' }],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }

    renderChatView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Thread A' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Thread A' }))
    await waitFor(() => {
      expect(screen.getByText('Thread A initial message')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'send from A' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

    fireEvent.click(screen.getByRole('button', { name: 'Thread B' }))
    await waitFor(() => {
      expect(screen.getByText('Thread B selected message')).toBeTruthy()
    })

    sendDeferred.resolve()

    await waitFor(() => {
      expect(screen.getByText('Thread B selected message')).toBeTruthy()
    })
    expect(screen.queryByText('Thread A reply after send')).toBeNull()
  })

  it('does not start thread while workspace options are not ready', async () => {
    const startThread = vi.fn(async () => ({ threadId: 'thread_new' }))

    gatewayForTest = {
      listThreads: vi.fn(async () => []),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: [] })),
      startThread,
      sendMessage: vi.fn(async () => ({})),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }

    renderChatView()

    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'start please' },
    })
    const sendButton = screen.getByRole('button', { name: 'Chat' })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)

    expect(startThread).not.toHaveBeenCalled()
  })

  it('disables send for threads without an active session', async () => {
    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_closed',
          title: 'Closed thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: false,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({
        turns: [
          {
            id: 'c1',
            role: 'assistant' as const,
            content: 'Past reply',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      })),
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

    renderChatView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Closed thread' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Closed thread' }))
    await waitFor(() => {
      expect(screen.getByText('Past reply')).toBeTruthy()
    })

    expect(
      screen.getByText('This conversation is closed. Start a new chat to continue.'),
    ).toBeTruthy()
    const sendMessage = vi.mocked(gatewayForTest!.sendMessage)
    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'should not send' },
    })
    const sendButton = screen.getByRole('button', { name: 'Chat' })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('consumes issue handoff after form options load', async () => {
    const formDeferred = createDeferred<{
      workspaces: { value: string; label: string }[]
      branches: { value: string; label: string }[]
      providers: { value: string; label: string }[]
      models: { value: string; label: string }[]
      defaultBranch: string
      defaultProvider: string
      defaultModel: string
    }>()
    const startThread = vi.fn(async () => ({ threadId: 'thr_from_issue' }))

    gatewayForTest = {
      listThreads: vi.fn(async () => []),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: [] })),
      startThread,
      sendMessage: vi.fn(async () => ({})),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(() => formDeferred.promise),
    }

    renderChatView()

    useAppStore.setState({
      chatAssistHandoff: {
        sourceContext: 'Issue context block',
        workspacePath: '/repo/main',
      },
    })

    expect(startThread).not.toHaveBeenCalled()

    formDeferred.resolve({
      workspaces: [{ value: '/repo/main', label: 'main' }],
      branches: [{ value: 'develop', label: 'develop' }],
      providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
      models: [{ value: 'model-x', label: 'Model X' }],
      defaultBranch: 'develop',
      defaultProvider: 'claude-sdk',
      defaultModel: 'model-x',
    })

    await waitFor(() => {
      expect(startThread).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceContext: 'Issue context block',
          workspacePath: '/repo/main',
          mode: 'interactive',
        }),
      )
    })
    expect(useAppStore.getState().chatAssistHandoff).toBeNull()
  })

  it('stores unsent draft on new chat and restores it from sidebar history', async () => {
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
        defaultBranch: 'develop',
        defaultProvider: 'claude-sdk',
        defaultModel: 'model-x',
      })),
    }

    renderChatView()

    const textarea = screen.getByPlaceholderText('Anything you need…') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'Keep this unsent draft so I can resume later' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await waitFor(() => {
      expect((screen.getByPlaceholderText('Anything you need…') as HTMLTextAreaElement).value).toBe(
        '',
      )
    })

    const savedDraftRow = await screen.findByRole('button', {
      name: 'Keep this unsent draft so I can resume later',
    })
    fireEvent.click(savedDraftRow)

    await waitFor(() => {
      expect((screen.getByPlaceholderText('Anything you need…') as HTMLTextAreaElement).value).toBe(
        'Keep this unsent draft so I can resume later',
      )
    })
  })

  it('shows Sending… while a send is in flight', async () => {
    const sendDeferred = createDeferred<void>()

    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_live',
          title: 'Live thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: [] })),
      startThread: vi.fn(async () => ({ threadId: 'thread_new' })),
      sendMessage: vi.fn(async () => {
        await sendDeferred.promise
        return {}
      }),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [{ value: '/repo/main', label: 'main' }],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }

    renderChatView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Live thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Live thread' }))
    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'hold please' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    })

    sendDeferred.resolve()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Sending…' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Chat' })).toBeTruthy()
    })
  })

  it('notifies when stream settles after a send', async () => {
    const sendDeferred = createDeferred<void>()
    const onThreadStreamSettled = vi.fn()
    let replied = false

    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_notify',
          title: 'Notify thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({
        turns: replied
          ? [
              {
                id: 'assistant-1',
                role: 'assistant' as const,
                content: 'Response after send',
                createdAt: '2026-06-01T00:01:00.000Z',
              },
            ]
          : [],
      })),
      startThread: vi.fn(async () => ({ threadId: 'thread_new' })),
      sendMessage: vi.fn(async () => {
        await sendDeferred.promise
        replied = true
        return {}
      }),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [{ value: '/repo/main', label: 'main' }],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }

    renderChatView({ onThreadStreamSettled })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notify thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Notify thread' }))
    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'send and settle' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
    sendDeferred.resolve()

    await waitFor(() => {
      expect(onThreadStreamSettled).toHaveBeenCalledWith({
        threadId: 'thread_notify',
        latestAssistantTurnId: 'assistant-1',
      })
    })
  })

  it('does not notify when no new assistant turn is added', async () => {
    const sendDeferred = createDeferred<void>()
    const onThreadStreamSettled = vi.fn()
    const existingTurns = [
      {
        id: 'assistant-existing',
        role: 'assistant' as const,
        content: 'Existing assistant turn',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]

    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_no_notify',
          title: 'No notify thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: existingTurns })),
      startThread: vi.fn(async () => ({ threadId: 'thread_new' })),
      sendMessage: vi.fn(async () => {
        await sendDeferred.promise
        return {}
      }),
      finalizeThread: vi.fn(async () => ({ body: 'spec' })),
      getFormOptions: vi.fn(async () => ({
        workspaces: [{ value: '/repo/main', label: 'main' }],
        branches: [{ value: 'develop', label: 'develop' }],
        providers: [{ value: 'claude-sdk', label: 'Claude (API)' }],
        models: [{ value: 'model-x', label: 'Model X' }],
        defaultProvider: 'claude-sdk',
      })),
    }

    renderChatView({ onThreadStreamSettled })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'No notify thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'No notify thread' }))
    await waitFor(() => {
      expect(screen.getByText('Existing assistant turn')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'send without reply' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
    sendDeferred.resolve()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Sending…' })).toBeNull()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onThreadStreamSettled).not.toHaveBeenCalled()
  })

  it('keeps a failed first send in draft history sidebar', async () => {
    gatewayForTest = {
      listThreads: vi.fn(async () => []),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({ turns: [] })),
      startThread: vi.fn(async () => {
        throw new Error(
          'Headless interactive assistant is not available. Check orbit configuration and retry.',
        )
      }),
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

    renderChatView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chat' })).toBeTruthy()
    })
    fireEvent.change(screen.getByPlaceholderText('Anything you need…'), {
      target: { value: 'first send should remain visible' },
    })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Chat' }) as HTMLButtonElement).disabled).toBe(
        false,
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

    await waitFor(() => {
      expect(screen.getAllByText('first send should remain visible').length).toBeGreaterThanOrEqual(
        2,
      )
      expect(
        screen.getByText(
          'Headless interactive assistant is not available. Check orbit configuration and retry.',
        ),
      ).toBeTruthy()
    })
    expect(
      screen.getByRole('button', {
        name: 'first send should remain visible',
      }),
    ).toBeTruthy()
  })

  it('copies the latest assistant reply into Add Task handoff', async () => {
    const recordChatToTaskMetric = vi.fn(async () => {})
    installOrbitMock({ recordChatToTaskMetric })
    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_live',
          title: 'Live thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({
        turns: [
          {
            id: 'u1',
            role: 'user' as const,
            content: 'Need an investigation summary.',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 'a1',
            role: 'assistant' as const,
            content: 'Investigation summary from chat.',
            createdAt: '2026-06-01T00:01:00.000Z',
          },
        ],
      })),
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

    renderChatView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Live thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Live thread' }))

    await waitFor(() => {
      expect(screen.getByText('Investigation summary from chat.')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy latest assistant reply to Add Task' }))

    await waitFor(() => {
      expect(useAppStore.getState().activeView).toBe('task')
      expect(useAppStore.getState().chatToTaskHandoff?.body).toBe(
        'Investigation summary from chat.',
      )
    })

    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_add_to_task_click' })
  })

  it('records truncated metric when assistant reply exceeds handoff limit', async () => {
    const recordChatToTaskMetric = vi.fn(async () => {})
    installOrbitMock({ recordChatToTaskMetric })
    const longReply = 'x'.repeat(CHAT_TO_TASK_HANDOFF_MAX_CHARS + 1)
    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_live',
          title: 'Live thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({
        turns: [
          {
            id: 'a1',
            role: 'assistant' as const,
            content: longReply,
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      })),
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

    renderChatView()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Live thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Live thread' }))
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Copy latest assistant reply to Add Task' }),
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy latest assistant reply to Add Task' }))

    await waitFor(() => {
      expect(useAppStore.getState().chatToTaskHandoff?.truncated).toBe(true)
    })
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_handoff_truncated' })
  })

  it('records retry metric when Add to task is retried after unavailable content', async () => {
    const recordChatToTaskMetric = vi.fn(async () => {})
    installOrbitMock({ recordChatToTaskMetric })
    gatewayForTest = {
      listThreads: vi.fn(async () => [
        {
          id: 'thread_live',
          title: 'Live thread',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ]),
      getActiveComposerSessionId: vi.fn(defaultGetActiveComposerSessionId),
      getThread: vi.fn(async () => ({
        turns: [
          {
            id: 'a1',
            role: 'assistant' as const,
            content: '   \n\t  ',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      })),
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

    renderChatView()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Live thread' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Live thread' }))
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Copy latest assistant reply to Add Task' }),
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy latest assistant reply to Add Task' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_to_task_retry' })
  })
})
