import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopCapabilities, installOrbitMock } from '../../__tests__/orbit-mock.js'
import { createChatGateway, resetChatGatewayForTests, useChatGateway } from '../use-chat-gateway.js'

describe('useChatGateway', () => {
  beforeEach(() => {
    resetChatGatewayForTests()
    installOrbitMock({
      getDesktopCapabilities: vi.fn(async () => desktopCapabilities()),
    })
  })

  afterEach(() => {
    resetChatGatewayForTests()
  })

  it('creates a gateway with the expected contract surface', async () => {
    const gateway = createChatGateway()
    expect(await gateway.listThreads()).toBeInstanceOf(Array)
    expect(await gateway.getFormOptions()).toHaveProperty('workspaces')
  })

  it('reuses the same gateway instance across unmount/remount', async () => {
    const first = renderHook(() => useChatGateway())
    await waitFor(() => {
      expect(window.orbit.getDesktopCapabilities).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(first.result.current.listThreads).toBeTypeOf('function')
    })
    const firstInstance = first.result.current
    first.unmount()

    const second = renderHook(() => useChatGateway())
    await waitFor(() => {
      expect(second.result.current).toBe(firstInstance)
    })
  })

  it('selects mock gateway when chatGateway override is mock', async () => {
    vi.mocked(window.orbit.getDesktopCapabilities).mockResolvedValue(
      desktopCapabilities({ conversationModeEnabled: true, chatGateway: 'mock' }),
    )
    resetChatGatewayForTests()

    const { result } = renderHook(() => useChatGateway())
    await waitFor(async () => {
      const threads = await result.current.listThreads()
      expect(threads.some((thread) => thread.id === 'thr_provider_detection')).toBe(true)
    })
  })

  it('selects orbit gateway when chatGateway is auto', async () => {
    vi.mocked(window.orbit.getDesktopCapabilities).mockResolvedValue(
      desktopCapabilities({ conversationModeEnabled: false, chatGateway: 'auto' }),
    )
    resetChatGatewayForTests()

    const { result } = renderHook(() => useChatGateway())
    await waitFor(() => {
      expect(result.current).toBeDefined()
    })

    const threads = await result.current.listThreads()
    expect(window.orbit.listConversationHistory).toHaveBeenCalled()
    expect(threads.some((thread) => thread.id === 'thr_provider_detection')).toBe(false)
  })

  it('forwards restartThreadSession through the lazy gateway to orbit IPC', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_rebound',
      question: '',
      recommendedAnswer: '',
      turnIndex: 0,
      readyToFinalize: false,
    }))
    installOrbitMock({
      getDesktopCapabilities: vi.fn(async () =>
        desktopCapabilities({ conversationModeEnabled: true, chatGateway: 'auto' }),
      ),
      getConversationHistory: vi.fn(async () => ({
        found: true as const,
        thread: {
          threadId: 'thr_1',
          title: 'Live',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T00:00:00.000Z',
          hasActiveSession: true,
          activeSessionId: 'composer_old',
        },
        turns: [],
      })),
      startComposerSession,
    })
    resetChatGatewayForTests()

    const { result } = renderHook(() => useChatGateway())
    await waitFor(() => {
      expect(result.current.restartThreadSession).toBeTypeOf('function')
    })

    await result.current.restartThreadSession?.({
      threadId: 'thr_1',
      workspacePath: '/repo/main',
      mode: 'agent',
    })

    expect(startComposerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionPolicy: 'planetz-chat-agent',
        conversationLedger: expect.objectContaining({
          existingThreadId: 'thr_1',
        }),
      }),
    )
  })

  it('falls back to orbit when capabilities fetch fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(window.orbit.getDesktopCapabilities).mockRejectedValue(
      new Error('capabilities error'),
    )
    resetChatGatewayForTests()

    const { result } = renderHook(() => useChatGateway())
    await waitFor(() => {
      expect(window.orbit.getDesktopCapabilities).toHaveBeenCalled()
    })

    const threads = await result.current.listThreads()
    expect(window.orbit.listConversationHistory).toHaveBeenCalled()
    expect(threads.some((thread) => thread.id === 'thr_provider_detection')).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
  })
})
