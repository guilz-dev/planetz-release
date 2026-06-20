import type { ChatComposerDraftSnapshot } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatGateway } from '../../components/chat/chat-types'
import { useChatComposerDraftPersistence } from '../use-chat-composer-draft-persistence.js'

function createGateway(
  overrides: Partial<Pick<ChatGateway, 'loadComposerDraft' | 'saveComposerDraft'>> = {},
): ChatGateway {
  return {
    listThreads: vi.fn(async () => []),
    getThread: vi.fn(async () => ({ turns: [] })),
    getActiveComposerSessionId: vi.fn(async (threadId: string) => `composer_${threadId}`),
    startThread: vi.fn(async () => ({ threadId: 'thread_1' })),
    sendMessage: vi.fn(async () => ({})),
    finalizeThread: vi.fn(async () => ({ body: '' })),
    getFormOptions: vi.fn(async () => ({
      workspaces: [],
      branches: [],
      providers: [],
      models: [],
    })),
    loadComposerDraft: vi.fn(async () => null),
    saveComposerDraft: vi.fn(async (_snapshot: ChatComposerDraftSnapshot) => {}),
    ...overrides,
  }
}

describe('useChatComposerDraftPersistence', () => {
  it('restores persisted draft state on mount', async () => {
    const gateway = createGateway({
      loadComposerDraft: vi.fn(async () => ({
        draft: 'Saved body',
        activeDraftId: 'draft_saved',
        selectedProvider: 'codex',
        selectedModel: 'gpt-5',
        items: [
          {
            id: 'draft_saved',
            title: 'Saved body',
            workspacePath: '/repo/main',
            workspaceLabel: 'main',
            updatedAt: '2026-06-01T12:00:00.000Z',
            body: 'Saved body',
          },
        ],
        updatedAt: '2026-06-01T12:00:00.000Z',
      })),
    })

    const { result } = renderHook(() => {
      const [draft, setDraft] = useState('')
      const [providerValue, setProviderValue] = useState('')
      const [modelValue, setModelValue] = useState('')
      const persistence = useChatComposerDraftPersistence({
        gateway,
        persistenceKey: '/repo/main',
        draft,
        setDraft,
        providerValue,
        setProviderValue,
        modelValue,
        setModelValue,
      })
      return { draft, providerValue, modelValue, ...persistence }
    })

    await waitFor(() => {
      expect(result.current.draft).toBe('Saved body')
      expect(result.current.providerValue).toBe('codex')
      expect(result.current.modelValue).toBe('gpt-5')
      expect(result.current.draftHistory).toHaveLength(1)
      expect(result.current.activeDraftId).toBe('draft_saved')
    })
  })

  it('flushes pending saves on unmount', async () => {
    vi.useFakeTimers()
    const saveComposerDraft = vi.fn(async (_snapshot: ChatComposerDraftSnapshot) => {})
    const gateway = createGateway({ saveComposerDraft })

    const { unmount, rerender } = renderHook(
      ({ draft }: { draft: string }) => {
        const [, setDraft] = useState('')
        const [providerValue, setProviderValue] = useState('claude-sdk')
        const [modelValue, setModelValue] = useState('claude-sonnet-4')
        return useChatComposerDraftPersistence({
          gateway,
          persistenceKey: '/repo/main',
          draft,
          setDraft,
          providerValue,
          setProviderValue,
          modelValue,
          setModelValue,
        })
      },
      { initialProps: { draft: '' } },
    )

    await act(async () => {
      await Promise.resolve()
    })

    rerender({ draft: 'Hello' })
    saveComposerDraft.mockClear()

    act(() => {
      unmount()
    })

    expect(saveComposerDraft).toHaveBeenCalledOnce()
    expect(saveComposerDraft.mock.calls[0]?.[0]).toMatchObject({
      draft: 'Hello',
      activeDraftId: null,
      selectedProvider: 'claude-sdk',
      selectedModel: 'claude-sonnet-4',
      items: [],
    })
    vi.useRealTimers()
  })

  it('does not persist a provider switch until the user selects a model', async () => {
    vi.useFakeTimers()
    const saveComposerDraft = vi.fn(async (_snapshot: ChatComposerDraftSnapshot) => {})
    const gateway = createGateway({
      loadComposerDraft: vi.fn(async () => ({
        draft: '',
        activeDraftId: null,
        selectedProvider: 'cursor',
        selectedModel: 'composer-2.5',
        items: [],
        updatedAt: '2026-06-01T12:00:00.000Z',
      })),
      saveComposerDraft,
    })

    const setDraft = vi.fn()
    const setProviderValue = vi.fn()
    const setModelValue = vi.fn()

    const { rerender } = renderHook(
      ({
        draft,
        providerValue,
        modelValue,
      }: {
        draft: string
        providerValue: string
        modelValue: string
      }) =>
        useChatComposerDraftPersistence({
          gateway,
          persistenceKey: '/repo/main',
          draft,
          setDraft,
          providerValue,
          setProviderValue,
          modelValue,
          setModelValue,
        }),
      {
        initialProps: {
          draft: '',
          providerValue: 'cursor',
          modelValue: 'composer-2.5',
        },
      },
    )

    await act(async () => {
      await Promise.resolve()
    })

    saveComposerDraft.mockClear()

    rerender({
      draft: 'typing',
      providerValue: 'ollama',
      modelValue: '',
    })

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    expect(saveComposerDraft).toHaveBeenCalled()
    expect(saveComposerDraft.mock.calls.at(-1)?.[0]).toMatchObject({
      draft: 'typing',
      selectedProvider: 'cursor',
      selectedModel: 'composer-2.5',
    })

    saveComposerDraft.mockClear()

    rerender({
      draft: 'typing',
      providerValue: 'ollama',
      modelValue: 'llama3.1:8b',
    })

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    expect(saveComposerDraft.mock.calls.at(-1)?.[0]).toMatchObject({
      draft: 'typing',
      selectedProvider: 'ollama',
      selectedModel: 'llama3.1:8b',
    })

    vi.useRealTimers()
  })

  it('continues saving after load failure', async () => {
    const saveComposerDraft = vi.fn(async (_snapshot: ChatComposerDraftSnapshot) => {})
    const gateway = createGateway({
      loadComposerDraft: vi.fn(async () => {
        throw new Error('load failed')
      }),
      saveComposerDraft,
    })

    const { rerender } = renderHook(
      ({ draft }: { draft: string }) => {
        const [, setDraft] = useState('')
        const [providerValue, setProviderValue] = useState('')
        const [modelValue, setModelValue] = useState('')
        return useChatComposerDraftPersistence({
          gateway,
          persistenceKey: '/repo/main',
          draft,
          setDraft,
          providerValue,
          setProviderValue,
          modelValue,
          setModelValue,
        })
      },
      { initialProps: { draft: '' } },
    )

    await waitFor(() => {
      expect(gateway.loadComposerDraft).toHaveBeenCalled()
    })

    rerender({ draft: 'After failure' })

    await waitFor(() => {
      expect(saveComposerDraft).toHaveBeenCalled()
    })
  })
})
