import { CHAT_HISTORY_SEARCH_DEBOUNCE_MS } from '@planetz/shared'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatThreadSummary } from '../../components/chat/chat-types'
import { filterChatThreadsByTitle } from '../../lib/chat-thread-search'
import { createFakeChatGateway } from '../../mocks/chat-gateway-fake'
import { useChatThreadController } from '../use-chat-thread-controller'

describe('useChatThreadController search debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces remote search by CHAT_HISTORY_SEARCH_DEBOUNCE_MS', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    const searchThreads = vi.spyOn(gateway, 'searchThreads')

    const { result } = renderHook(() =>
      useChatThreadController({
        gateway,
        chatMode: 'interactive',
        setChatMode: vi.fn(),
      }),
    )

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    act(() => {
      result.current.setSearch('auth')
    })

    await act(async () => {
      vi.advanceTimersByTime(CHAT_HISTORY_SEARCH_DEBOUNCE_MS - 1)
    })
    expect(searchThreads).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(searchThreads).toHaveBeenCalledWith(expect.objectContaining({ query: 'auth' }))
  })

  it('keeps local title matches when merging remote search results', async () => {
    const gateway = createFakeChatGateway({
      threads: [
        {
          id: 'local_only',
          title: 'Auth notes',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
        },
      ],
    })
    vi.spyOn(gateway, 'searchThreads').mockResolvedValue([
      {
        id: 'remote_hit',
        title: 'Remote auth thread',
        workspacePath: '/repo/main',
        workspaceLabel: 'main',
        updatedAt: '2026-06-01T01:00:00.000Z',
        hasActiveSession: true,
      },
    ])

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    act(() => result.current.setSearch('auth'))

    await act(async () => {
      vi.advanceTimersByTime(CHAT_HISTORY_SEARCH_DEBOUNCE_MS)
    })

    const ids = result.current.threads.map((thread) => thread.id)
    expect(ids).toContain('remote_hit')
    expect(ids).toContain('local_only')
    expect(filterChatThreadsByTitle(result.current.threads, 'auth').length).toBeGreaterThanOrEqual(
      2,
    )
  })

  it('ignores stale remote search responses when the query changes', async () => {
    const gateway = createFakeChatGateway({ threads: [] })
    let resolveSlow: ((value: ChatThreadSummary[]) => void) | undefined
    const slowPromise = new Promise<ChatThreadSummary[]>((resolve) => {
      resolveSlow = resolve
    })
    vi.spyOn(gateway, 'searchThreads').mockImplementation(async ({ query }) => {
      if (query === 'slow') return slowPromise
      return [
        {
          id: 'fast_hit',
          title: 'Fast result',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T02:00:00.000Z',
          hasActiveSession: true,
        },
      ]
    })

    const { result } = renderHook(() =>
      useChatThreadController({ gateway, chatMode: 'interactive', setChatMode: vi.fn() }),
    )

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    act(() => result.current.setSearch('slow'))
    await act(async () => {
      vi.advanceTimersByTime(CHAT_HISTORY_SEARCH_DEBOUNCE_MS)
    })

    act(() => result.current.setSearch('fast'))
    await act(async () => {
      vi.advanceTimersByTime(CHAT_HISTORY_SEARCH_DEBOUNCE_MS)
    })

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(result.current.threads.some((thread) => thread.id === 'fast_hit')).toBe(true)

    resolveSlow?.([
      {
        id: 'stale_hit',
        title: 'Stale',
        workspacePath: '/repo/main',
        workspaceLabel: 'main',
        updatedAt: '2026-06-01T00:00:00.000Z',
        hasActiveSession: true,
      },
    ])
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(result.current.threads.some((thread) => thread.id === 'stale_hit')).toBe(false)
  })
})
