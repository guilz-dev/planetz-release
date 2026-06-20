import type { OrbitInteractiveStreamLine } from '@planetz/shared'
import { ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge, installOrbitMock } from '../../__tests__/orbit-mock'
import type {
  ChatGateway,
  ChatThreadLoadResult,
  ChatThreadSummary,
} from '../../components/chat/chat-types'
import { CHAT_CANCEL_SETTLE_MS } from '../../lib/chat-stream-state'
import { createFakeChatGateway } from '../../mocks/chat-gateway-fake'
import { useChatThreadSend } from '../use-chat-thread-send'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Production ledger rows use composer session id as threadId. */
const COMPOSER_SESSION_ID = 'composer_stream_test'
const LEDGER_THREAD_ID = COMPOSER_SESSION_ID

const OTHER_THREAD_ID = 'composer_other_session'

const ACTIVE_THREAD: ChatThreadSummary = {
  id: LEDGER_THREAD_ID,
  title: 'Live',
  workspacePath: '/repo/main',
  workspaceLabel: 'main',
  updatedAt: '2026-06-01T00:00:00.000Z',
  hasActiveSession: true,
}

const OTHER_THREAD: ChatThreadSummary = {
  id: OTHER_THREAD_ID,
  title: 'Other',
  workspacePath: '/repo/main',
  workspaceLabel: 'main',
  updatedAt: '2026-06-01T00:01:00.000Z',
  hasActiveSession: true,
}

function createSendHookOptions(gateway: ChatGateway) {
  const setDraft = vi.fn()
  const setSpecPreview = vi.fn()
  const refreshThreads = vi.fn(async () => {})
  return {
    gateway,
    chatMode: 'interactive' as const,
    threadSummariesForLookup: [ACTIVE_THREAD],
    refreshThreads,
    draft: 'Hello',
    setDraft,
    setSpecPreview,
    workspaceValue: '/repo/main',
    branchValue: 'main',
    providerValue: 'claude-sdk',
    modelValue: 'claude-sonnet-4',
    effortValue: 'medium',
    canStartThread: true,
    setProviderValue: vi.fn(),
    setModelValue: vi.fn(),
    setWorkspaceValue: vi.fn(),
    setChatMode: vi.fn(),
  }
}

function streamTextLine(sessionId: string, text: string, seq: number): OrbitInteractiveStreamLine {
  return {
    v: ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION,
    sessionId,
    seq,
    event: { type: 'text', data: { text } },
  }
}

describe('useChatThreadSend composer stream', () => {
  const streamListeners: Array<(line: OrbitInteractiveStreamLine) => void> = []

  beforeEach(() => {
    streamListeners.length = 0
    installOrbitMock(
      createDefaultOrbitBridge({
        onComposerSessionStream: (cb: (line: OrbitInteractiveStreamLine) => void) => {
          streamListeners.push(cb)
          return () => {
            const index = streamListeners.indexOf(cb)
            if (index >= 0) streamListeners.splice(index, 1)
          }
        },
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function emitStream(line: OrbitInteractiveStreamLine) {
    for (const listener of streamListeners) {
      listener(line)
    }
  }

  it('updates streamingTurn when sessionId matches active composer session', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
      expect(result.current.inFlightAssistant).toEqual({
        status: 'thinking',
        streamingTurn: expect.objectContaining({ text: '' }),
      })
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'partial ', 1))
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'text', 2))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('partial text')
    })

    await act(async () => {
      sendDeferred.resolve({})
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('idle')
      expect(result.current.streamingTurn).toBeNull()
    })
  })

  it('flushes partial streamingTurn when done arrives before the next animation frame', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const rafCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'fast partial', 1))
      emitStream({
        v: ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION,
        sessionId: COMPOSER_SESSION_ID,
        seq: 2,
        done: true,
      })
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('fast partial')
    })
    expect(rafCallbacks.length).toBeGreaterThan(0)

    await act(async () => {
      sendDeferred.resolve({})
    })

    rafSpy.mockRestore()
  })

  it('seeds a placeholder streaming turn for providers without live stream support', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() =>
      useChatThreadSend({
        ...createSendHookOptions(gateway),
        providerValue: 'mock',
        modelValue: 'mock-model',
      }),
    )

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
      expect(result.current.sending).toBe(true)
      expect(result.current.inFlightAssistant?.status).toBe('thinking')
    })

    await act(async () => {
      sendDeferred.resolve({})
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('idle')
      expect(result.current.streamingTurn).toBeNull()
    })
  })

  it('ignores stream lines for a different sessionId', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(OTHER_THREAD_ID, 'ignored', 1))
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.streamingTurn?.text ?? '').toBe('')

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('rebinds stream session id when fallback thread id was stale', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const legacyThread: ChatThreadSummary = {
      id: 'thread_legacy',
      title: 'Legacy',
      workspacePath: '/repo/main',
      workspaceLabel: 'main',
      updatedAt: '2026-06-01T00:02:00.000Z',
      hasActiveSession: true,
    }
    const gateway = createFakeChatGateway({
      threads: [legacyThread],
      sessionIdByThread: { [legacyThread.id]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)
    vi.spyOn(gateway, 'getActiveComposerSessionId').mockRejectedValue(
      new Error('active session lookup failed'),
    )

    const { result } = renderHook(() =>
      useChatThreadSend({
        ...createSendHookOptions(gateway),
        threadSummariesForLookup: [legacyThread],
      }),
    )

    await act(async () => {
      result.current.handleSelectThread(legacyThread.id)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'rebound partial', 1))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('rebound partial')
    })

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('clears streamingTurn when done line has aborted flag', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'partial', 1))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('partial')
    })

    act(() => {
      emitStream({
        v: ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION,
        sessionId: COMPOSER_SESSION_ID,
        seq: 2,
        done: true,
        aborted: true,
      })
    })

    await waitFor(() => {
      expect(result.current.streamingTurn).toBeNull()
    })

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('ignores stream lines after cancelSend bumps generation', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      result.current.cancelSend()
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'stale', 1))
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.streamingTurn).toBeNull()

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('clears streamingTurn when selecting another thread during an in-flight send', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD, OTHER_THREAD],
      turnsByThread: {
        [LEDGER_THREAD_ID]: [
          {
            id: 'turn_a',
            role: 'user',
            content: 'old thread message',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
        [OTHER_THREAD_ID]: [
          {
            id: 'turn_b',
            role: 'user',
            content: 'other thread message',
            createdAt: '2026-06-01T00:01:00.000Z',
          },
        ],
      },
      sessionIdByThread: {
        [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID,
        [OTHER_THREAD_ID]: 'composer_other_thread',
      },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)
    const otherThreadLoadDeferred = createDeferred<ChatThreadLoadResult>()
    const originalGetThread = gateway.getThread.bind(gateway)
    vi.spyOn(gateway, 'getThread').mockImplementation(async (threadId) => {
      if (threadId === OTHER_THREAD_ID) {
        return otherThreadLoadDeferred.promise
      }
      return originalGetThread(threadId)
    })

    const { result } = renderHook(() =>
      useChatThreadSend({
        ...createSendHookOptions(gateway),
        threadSummariesForLookup: [ACTIVE_THREAD, OTHER_THREAD],
      }),
    )

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await waitFor(() => {
      expect(result.current.turns[0]?.content).toBe('old thread message')
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'partial', 1))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('partial')
    })

    await act(async () => {
      result.current.handleSelectThread(OTHER_THREAD_ID)
    })

    expect(result.current.streamingTurn).toBeNull()
    expect(result.current.streamState).toBe('idle')
    expect(result.current.inFlightAssistant).toBeNull()
    expect(result.current.turns).toEqual([])
    expect(result.current.threadLoading).toBe(true)
    expect(result.current.turns.some((turn) => turn.content.includes('old thread'))).toBe(false)

    await act(async () => {
      otherThreadLoadDeferred.resolve({
        turns: [
          {
            id: 'turn_b',
            role: 'user',
            content: 'other thread message',
            createdAt: '2026-06-01T00:01:00.000Z',
          },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.threadLoading).toBe(false)
      expect(result.current.turns[0]?.content).toBe('other thread message')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'stale after switch', 2))
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.streamingTurn).toBeNull()

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('does not carry previous partial text into the next send', async () => {
    const firstSendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const secondSendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage')
      .mockImplementationOnce(() => firstSendDeferred.promise)
      .mockImplementationOnce(() => secondSendDeferred.promise)

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'first partial', 1))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('first partial')
    })

    await act(async () => {
      firstSendDeferred.resolve({})
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('idle')
      expect(result.current.streamingTurn).toBeNull()
    })

    await act(async () => {
      result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      emitStream(streamTextLine(COMPOSER_SESSION_ID, 'second partial', 2))
    })

    await waitFor(() => {
      expect(result.current.streamingTurn?.text).toBe('second partial')
    })

    await act(async () => {
      secondSendDeferred.resolve({})
    })
  })

  it('shows in-flight row immediately after send starts before streamingTurn is seeded', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const sessionDeferred = createDeferred<string>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)
    vi.spyOn(gateway, 'getActiveComposerSessionId').mockImplementation(
      () => sessionDeferred.promise,
    )

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
      expect(result.current.inFlightAssistant).toEqual({
        status: 'thinking',
        streamingTurn: null,
      })
    })

    await act(async () => {
      sessionDeferred.resolve(COMPOSER_SESSION_ID)
    })

    await waitFor(() => {
      expect(result.current.streamingTurn).not.toBeNull()
    })

    await act(async () => {
      sendDeferred.resolve({})
    })
  })

  it('transitions cancelSend through cancelling to idle and clears optimistic turns', async () => {
    const sendDeferred = createDeferred<{ compactionSummary?: undefined }>()
    const gateway = createFakeChatGateway({
      threads: [ACTIVE_THREAD],
      sessionIdByThread: { [LEDGER_THREAD_ID]: COMPOSER_SESSION_ID },
    })
    vi.spyOn(gateway, 'sendMessage').mockImplementation(() => sendDeferred.promise)
    const cancelSend = vi.fn(async () => {})
    gateway.cancelSend = cancelSend

    const { result } = renderHook(() => useChatThreadSend(createSendHookOptions(gateway)))

    await act(async () => {
      result.current.handleSelectThread(LEDGER_THREAD_ID)
    })

    await act(async () => {
      void result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(result.current.streamState).toBe('streaming')
    })

    act(() => {
      result.current.cancelSend()
    })

    expect(result.current.streamState).toBe('cancelling')
    expect(result.current.inFlightAssistant?.status).toBe('cancelling')
    expect(result.current.turns.some((turn) => turn.id.startsWith('optimistic_'))).toBe(false)

    await waitFor(
      () => {
        expect(result.current.streamState).toBe('idle')
      },
      { timeout: CHAT_CANCEL_SETTLE_MS + 100 },
    )
    expect(result.current.inFlightAssistant).toBeNull()
    expect(cancelSend).toHaveBeenCalledWith({ threadId: LEDGER_THREAD_ID })

    await act(async () => {
      sendDeferred.resolve({})
    })
  })
})
