import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatGateway, ChatThreadSummary } from '../../components/chat/chat-types'
import { createFakeChatGateway } from '../../mocks/chat-gateway-fake'
import { useChatThreadSend } from '../use-chat-thread-send'

const THREAD: ChatThreadSummary = {
  id: 'thr_legacy_policy',
  title: 'Legacy',
  workspacePath: '/repo/main',
  workspaceLabel: 'main',
  updatedAt: '2026-06-01T00:00:00.000Z',
  hasActiveSession: true,
}

function createSendHookOptions(gateway: ChatGateway, setChatMode: ReturnType<typeof vi.fn>) {
  return {
    gateway,
    chatMode: 'interactive' as const,
    threadSummariesForLookup: [THREAD],
    refreshThreads: vi.fn(async () => {}),
    draft: '',
    setDraft: vi.fn(),
    setSpecPreview: vi.fn(),
    workspaceValue: '/repo/main',
    branchValue: 'main',
    providerValue: 'claude-sdk',
    modelValue: 'claude-sonnet-4',
    effortValue: 'medium',
    canStartThread: true,
    setProviderValue: vi.fn(),
    setModelValue: vi.fn(),
    setWorkspaceValue: vi.fn(),
    setChatMode,
  }
}

describe('useChatThreadSend session policy', () => {
  it('syncs chat mode from getThread sessionPolicy after selecting a thread', async () => {
    const setChatMode = vi.fn()
    const base = createFakeChatGateway({
      threads: [THREAD],
      turnsByThread: { [THREAD.id]: [] },
    })
    const gateway: ChatGateway = {
      ...base,
      getThread: async (_threadId) => ({
        turns: [],
        sessionPolicy: 'planetz-chat-spec',
      }),
    }

    const { result } = renderHook(() =>
      useChatThreadSend(createSendHookOptions(gateway, setChatMode)),
    )

    await act(async () => {
      result.current.handleSelectThread(THREAD.id)
    })

    await waitFor(() => {
      expect(setChatMode).toHaveBeenCalledWith('spec')
    })
  })

  it('restarts active thread session before send when session config changed', async () => {
    const setChatMode = vi.fn()
    const gateway = createFakeChatGateway({
      threads: [THREAD],
      turnsByThread: { [THREAD.id]: [] },
    })
    const restartThreadSession = vi.spyOn(gateway, 'restartThreadSession')
    const sendMessage = vi.spyOn(gateway, 'sendMessage')

    const { result } = renderHook(() =>
      useChatThreadSend({
        ...createSendHookOptions(gateway, setChatMode),
        draft: 'send after model switch',
        modelValue: 'claude-opus-4.1',
        effortValue: 'low',
      }),
    )

    await act(async () => {
      result.current.handleSelectThread(THREAD.id)
    })

    act(() => {
      result.current.markSessionConfigDirty()
    })

    await act(async () => {
      await result.current.handleSend('send')
    })

    await waitFor(() => {
      expect(restartThreadSession).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: THREAD.id,
          mode: 'interactive',
          provider: 'claude-sdk',
          model: 'claude-opus-4.1',
          effort: 'low',
        }),
      )
      expect(sendMessage).toHaveBeenCalledOnce()
    })
  })
})
