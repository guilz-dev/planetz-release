import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

import type { ChatThreadSummary } from '../../components/chat/chat-types'
import { CHAT_CANCEL_SETTLE_MS } from '../../lib/chat-stream-state'
import { createFakeChatGateway } from '../../mocks/chat-gateway-fake'
import { useChatThreadController } from '../use-chat-thread-controller'

describe('useChatThreadController', () => {
  it('starts a thread on first send and refreshes turns from the gateway', async () => {
    const gateway = createFakeChatGateway({
      threads: [],
    })
    const startThread = vi.spyOn(gateway, 'startThread')
    const sendMessage = vi.spyOn(gateway, 'sendMessage')

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.workspaceValue).toBeTruthy()
    })

    act(() => {
      result.current.setDraft('Hello from test')
    })

    await act(async () => {
      await result.current.handleSend('send')
    })

    expect(startThread).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(result.current.turns.some((turn) => turn.role === 'assistant')).toBe(true)
    })
    expect(result.current.streamState).toBe('idle')
  })

  it('does not send on read-only threads', async () => {
    const gateway = createFakeChatGateway({
      threads: [
        {
          id: 'closed_thr',
          title: 'Closed',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: false,
        },
      ],
      turnsByThread: {
        closed_thr: [
          {
            id: 't1',
            role: 'assistant',
            content: 'Past',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
    })
    const sendMessage = vi.spyOn(gateway, 'sendMessage')

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1)
    })

    await act(async () => {
      result.current.handleSelectThread('closed_thr')
    })

    await waitFor(() => {
      expect(result.current.threadReadOnly).toBe(true)
    })

    act(() => {
      result.current.setDraft('Should not send')
    })

    await act(async () => {
      await result.current.handleSend('send')
    })

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('keeps read-only send guard when the active thread is filtered out of sidebar search', async () => {
    const gateway = createFakeChatGateway({
      threads: [
        {
          id: 'closed_thr',
          title: 'Closed conversation',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: false,
        },
        {
          id: 'open_thr',
          title: 'Open chat',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T01:00:00.000Z',
          hasActiveSession: true,
        },
      ],
      turnsByThread: {
        closed_thr: [
          {
            id: 't1',
            role: 'assistant',
            content: 'Past',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
    })
    const sendMessage = vi.spyOn(gateway, 'sendMessage')

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.threads.length).toBeGreaterThanOrEqual(2)
    })

    await act(async () => {
      result.current.handleSelectThread('closed_thr')
    })

    await waitFor(() => {
      expect(result.current.threadReadOnly).toBe(true)
    })

    act(() => {
      result.current.setSearch('open')
    })

    await waitFor(() => {
      expect(result.current.threads.some((thread) => thread.id === 'closed_thr')).toBe(false)
      expect(result.current.threadReadOnly).toBe(true)
    })

    act(() => {
      result.current.setDraft('Should not send')
    })

    await act(async () => {
      await result.current.handleSend('send')
    })

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('blocks send on read-only threads that appear only via remote search', async () => {
    const remoteOnly: ChatThreadSummary = {
      id: 'remote_only_thr',
      title: 'Remote archived chat',
      workspacePath: '/repo/main',
      workspaceLabel: 'main',
      updatedAt: '2026-06-01T00:00:00.000Z',
      hasActiveSession: false,
    }
    const gateway = createFakeChatGateway({
      threads: [
        {
          id: 'listed_thr',
          title: 'Listed open chat',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T01:00:00.000Z',
          hasActiveSession: true,
        },
      ],
      turnsByThread: {
        remote_only_thr: [
          {
            id: 't1',
            role: 'assistant',
            content: 'Remote past',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
    })
    vi.spyOn(gateway, 'listThreads').mockResolvedValue([
      {
        id: 'listed_thr',
        title: 'Listed open chat',
        workspacePath: '/repo/main',
        workspaceLabel: 'main',
        updatedAt: '2026-06-01T01:00:00.000Z',
        hasActiveSession: true,
      },
    ])
    gateway.searchThreads = vi.fn(async () => [remoteOnly])
    const sendMessage = vi.spyOn(gateway, 'sendMessage')

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
      }),
    )

    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => {
      result.current.setSearch('remote')
    })

    await waitFor(() => {
      expect(result.current.threads.some((thread) => thread.id === 'remote_only_thr')).toBe(true)
    })

    await act(async () => {
      result.current.handleSelectThread('remote_only_thr')
    })

    await waitFor(() => {
      expect(result.current.threadReadOnly).toBe(true)
    })

    act(() => {
      result.current.setDraft('Should not send')
    })

    await act(async () => {
      await result.current.handleSend('send')
    })

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('finalize creates a thread when needed and sets spec preview', async () => {
    const gateway = createFakeChatGateway()
    const finalizeThread = vi.spyOn(gateway, 'finalizeThread').mockResolvedValue({
      body: 'Final spec body',
      allowedActions: ['save_task', 'continue'],
    })

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'spec',
        setChatMode: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.canSubmit).toBe(true)
    })

    await act(async () => {
      await result.current.handleSend('finalize')
    })

    expect(finalizeThread).toHaveBeenCalledOnce()
    expect(result.current.specPreview?.body).toBe('Final spec body')
  })

  it('records stream errors and supports retry after a failed send', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    const sendMessage = vi.spyOn(gateway, 'sendMessage')
    sendMessage.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => result.current.setDraft('retry me'))
    await act(async () => {
      await result.current.handleSend('send')
    })
    expect(result.current.streamState).toBe('error')
    expect(result.current.streamError).toMatch(/network down/)

    sendMessage.mockRestore()
    await act(async () => {
      result.current.retrySend()
    })
    await waitFor(() => expect(result.current.streamState).toBe('idle'))
    expect(result.current.turns.some((turn) => turn.role === 'assistant')).toBe(true)
  })

  it('sets stream error when starting a thread fails', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    vi.spyOn(gateway, 'startThread').mockRejectedValueOnce(new Error('runner missing'))

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => result.current.setDraft('hello'))
    await act(async () => {
      await result.current.handleSend('send')
    })

    expect(result.current.streamState).toBe('error')
    expect(result.current.streamError).toMatch(/runner missing/)
    expect(result.current.inFlightAssistant).toBeNull()
    expect(
      result.current.turns.some((turn) => turn.role === 'user' && turn.content === 'hello'),
    ).toBe(true)
    expect(result.current.threads.some((thread) => thread.id.startsWith('draft_'))).toBe(true)
    expect(result.current.activeSidebarThreadId?.startsWith('draft_')).toBe(true)
  })

  it('adds the user message immediately when send is clicked', async () => {
    const startDeferred = createDeferred<{ threadId: string }>()
    const sendDeferred = createDeferred<Record<string, never>>()
    const gateway = createFakeChatGateway({ threads: [] })
    vi.spyOn(gateway, 'startThread').mockImplementation(() => startDeferred.promise)
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => result.current.setDraft('instant echo'))
    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(
        result.current.turns.some(
          (turn) => turn.role === 'user' && turn.content === 'instant echo',
        ),
      ).toBe(true)
    })

    await act(async () => {
      startDeferred.resolve({ threadId: 'thread_delayed' })
      sendDeferred.resolve({})
      await Promise.all([startDeferred.promise, sendDeferred.promise])
    })

    await waitFor(() => expect(result.current.streamState).toBe('idle'))
  })

  it('cancelSend returns to idle and ignores a late sendMessage response', async () => {
    const sendDeferred = createDeferred<Record<string, never>>()
    const gateway = createFakeChatGateway({
      threads: [
        {
          id: 'thr_live',
          title: 'Live',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ],
      turnsByThread: {
        thr_live: [],
      },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)
    const cancelSend = vi.spyOn(gateway, 'cancelSend')
    const getThread = vi.spyOn(gateway, 'getThread')
    getThread.mockResolvedValueOnce({ turns: [] })
    getThread.mockResolvedValue({
      turns: [
        {
          id: 'late',
          role: 'assistant',
          content: 'Late reply',
          createdAt: '2026-06-01T00:01:00.000Z',
        },
      ],
    })

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    await act(async () => {
      result.current.handleSelectThread('thr_live')
    })
    await waitFor(() => expect(result.current.activeThreadId).toBe('thr_live'))

    act(() => result.current.setDraft('Hello'))
    await act(async () => {
      void result.current.handleSend('send')
    })
    await waitFor(() => expect(result.current.inFlightAssistant).not.toBeNull())

    act(() => {
      result.current.cancelSend()
    })
    expect(cancelSend).toHaveBeenCalledWith({ threadId: 'thr_live' })
    expect(result.current.streamState).toBe('cancelling')
    await waitFor(
      () => {
        expect(result.current.streamState).toBe('idle')
      },
      { timeout: CHAT_CANCEL_SETTLE_MS + 100 },
    )
    expect(result.current.turns.every((turn) => !turn.id.startsWith('optimistic_'))).toBe(true)

    await act(async () => {
      sendDeferred.resolve({})
      await sendDeferred.promise
    })
    await waitFor(() => expect(result.current.streamState).toBe('idle'))
    expect(result.current.turns.some((turn) => turn.content === 'Late reply')).toBe(false)
  })

  it('handleNewChat clears stream error and idle state', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    vi.spyOn(gateway, 'sendMessage').mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => result.current.setDraft('fail'))
    await act(async () => {
      await result.current.handleSend('send')
    })
    expect(result.current.streamState).toBe('error')

    act(() => result.current.handleNewChat())
    expect(result.current.streamState).toBe('idle')
    expect(result.current.streamError).toBeNull()
  })

  it('updates an existing draft history row when re-saving from New chat', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )
    await waitFor(() => expect(result.current.workspaceValue).toBeTruthy())

    act(() => result.current.setDraft('First unsent draft'))
    act(() => result.current.handleNewChat())

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1)
    })
    const firstDraft = result.current.threads[0]
    expect(firstDraft?.id.startsWith('draft_')).toBe(true)

    act(() => result.current.handleSelectThread(firstDraft!.id))
    await waitFor(() => {
      expect(result.current.draft).toBe('First unsent draft')
    })

    act(() => result.current.setDraft('Updated draft after edit'))
    act(() => result.current.handleNewChat())

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1)
      expect(result.current.threads[0]?.id).toBe(firstDraft!.id)
      expect(result.current.threads[0]?.title).toBe('Updated draft after edit')
    })
    expect(result.current.draft).toBe('')
  })

  it('restores persisted composer drafts on mount', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    gateway.getFormOptions = vi.fn(async () => ({
      workspaces: [{ value: '/repo/main', label: 'main' }],
      branches: [{ value: 'main', label: 'main' }],
      providers: [
        { value: 'claude-sdk', label: 'Claude (API)' },
        { value: 'codex', label: 'Codex' },
      ],
      models: [{ value: 'claude-sonnet-4', label: 'Sonnet 4' }],
      modelsByProvider: {
        'claude-sdk': [{ value: 'claude-sonnet-4', label: 'Sonnet 4' }],
        codex: [{ value: 'gpt-5', label: 'GPT-5' }],
      },
      efforts: [],
      effortsByProvider: {},
      defaultProvider: 'claude-sdk',
      defaultModel: 'claude-sonnet-4',
    }))
    gateway.loadComposerDraft = vi.fn(async () => ({
      draft: 'Saved draft body',
      activeDraftId: 'draft_saved',
      selectedProvider: 'codex',
      selectedModel: 'gpt-5',
      items: [
        {
          id: 'draft_saved',
          title: 'Saved draft body',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T12:00:00.000Z',
          body: 'Saved draft body',
        },
      ],
      updatedAt: '2026-06-01T12:00:00.000Z',
    }))

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
        currentWorkspacePath: '/repo/main',
      }),
    )

    await waitFor(() => {
      expect(result.current.draft).toBe('Saved draft body')
      expect(result.current.providerValue).toBe('codex')
      expect(result.current.modelValue).toBe('gpt-5')
      expect(result.current.threads.some((thread) => thread.id === 'draft_saved')).toBe(true)
      expect(result.current.activeSidebarThreadId).toBe('draft_saved')
    })
  })
})
