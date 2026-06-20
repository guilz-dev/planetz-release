import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatGateway } from '../../components/chat/chat-types'
import { useChatComposerState } from '../use-chat-composer-state.js'

function createGateway(overrides: Partial<Pick<ChatGateway, 'getFormOptions'>> = {}): ChatGateway {
  return {
    listThreads: vi.fn(async () => []),
    getThread: vi.fn(async () => ({ turns: [] })),
    getActiveComposerSessionId: vi.fn(async (threadId: string) => `composer_${threadId}`),
    startThread: vi.fn(async () => ({ threadId: 'thread_1' })),
    sendMessage: vi.fn(async () => ({})),
    finalizeThread: vi.fn(async () => ({ body: '' })),
    getFormOptions: vi.fn(async () => ({
      workspaces: [],
      branches: [{ value: 'main', label: 'main' }],
      providers: [
        { value: 'cursor', label: 'Cursor' },
        { value: 'ollama', label: 'Ollama (local)' },
      ],
      models: [],
      modelsByProvider: {
        cursor: [{ value: 'composer-2.5', label: 'composer-2.5' }],
        ollama: [{ value: 'llama3.1:8b', label: 'llama3.1:8b' }],
      },
      defaultProvider: 'cursor',
      defaultModel: 'composer-2.5',
    })),
    ...overrides,
  }
}

describe('useChatComposerState', () => {
  it('does not reload form options when allowedProviders identity changes with same values', async () => {
    const getFormOptions = vi
      .fn()
      .mockResolvedValueOnce({
        workspaces: [],
        branches: [{ value: 'main', label: 'main' }],
        providers: [{ value: 'cursor', label: 'Cursor' }],
        models: [],
        modelsByProvider: {
          cursor: [{ value: 'composer-2.5', label: 'composer-2.5' }],
        },
        defaultProvider: 'cursor',
        defaultModel: 'composer-2.5',
      })
      .mockResolvedValueOnce({
        workspaces: [],
        branches: [{ value: 'main', label: 'main' }],
        providers: [{ value: 'cursor', label: 'Cursor' }],
        models: [],
        modelsByProvider: {},
        defaultProvider: 'cursor',
      })
    const gateway = createGateway({ getFormOptions })

    const { result, rerender } = renderHook(
      ({ allowedProviders }: { allowedProviders: string[] }) =>
        useChatComposerState({
          gateway,
          currentWorkspacePath: '/repo/main',
          allowedProviders,
        }),
      {
        initialProps: { allowedProviders: ['cursor'] },
      },
    )

    await waitFor(() => {
      expect(result.current.providerValue).toBe('cursor')
      expect(result.current.modelValue).toBe('composer-2.5')
    })

    rerender({ allowedProviders: ['cursor'] })

    await waitFor(() => {
      expect(result.current.modelValue).toBe('composer-2.5')
    })
    expect(getFormOptions).toHaveBeenCalledTimes(1)
  })

  it('clears model when provider changes so cross-provider models are not kept', async () => {
    const gateway = createGateway()
    const { result } = renderHook(() =>
      useChatComposerState({
        gateway,
        currentWorkspacePath: '/repo/main',
      }),
    )

    await waitFor(() => {
      expect(result.current.providerValue).toBe('cursor')
      expect(result.current.modelValue).toBe('composer-2.5')
    })

    act(() => {
      result.current.setProviderValue('ollama')
    })

    await waitFor(() => {
      expect(result.current.providerValue).toBe('ollama')
      expect(result.current.modelValue).toBe('')
      expect(result.current.modelOptions.map((option) => option.value)).toEqual(['llama3.1:8b'])
    })
  })

  it('restores the provider-scoped remembered model after a provider switch', async () => {
    const gateway = createGateway({
      getFormOptions: vi.fn(async () => ({
        workspaces: [],
        branches: [{ value: 'main', label: 'main' }],
        providers: [
          { value: 'cursor', label: 'Cursor' },
          { value: 'ollama', label: 'Ollama (local)' },
        ],
        models: [],
        modelsByProvider: {
          cursor: [{ value: 'composer-2.5', label: 'composer-2.5' }],
          ollama: [{ value: 'llama3.1:8b', label: 'llama3.1:8b' }],
        },
        lastSelectedModelByProvider: {
          cursor: 'composer-2.5',
          ollama: 'llama3.1:8b',
        },
        defaultProvider: 'cursor',
        defaultModel: 'composer-2.5',
      })),
    })
    const { result } = renderHook(() =>
      useChatComposerState({
        gateway,
        currentWorkspacePath: '/repo/main',
      }),
    )

    await waitFor(() => {
      expect(result.current.providerValue).toBe('cursor')
      expect(result.current.modelValue).toBe('composer-2.5')
    })

    act(() => {
      result.current.setProviderValue('ollama')
    })

    await waitFor(() => {
      expect(result.current.providerValue).toBe('ollama')
      expect(result.current.modelValue).toBe('llama3.1:8b')
    })
  })
})
