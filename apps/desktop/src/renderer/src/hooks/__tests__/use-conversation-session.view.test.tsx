import { composerSessionNotFoundMessage } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge, installOrbitMock } from '../../__tests__/orbit-mock'
import { I18nProvider } from '../../i18n/i18n-provider'
import { useConversationSession } from '../use-conversation-session'

function renderSessionHook(input: Parameters<typeof useConversationSession>[0]) {
  const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>
  return renderHook(() => useConversationSession(input), { wrapper })
}

describe('useConversationSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reports timeout errors with retry on start failure', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getComposerAssistCapabilities: vi.fn(async () => ({
          startMode: 'planning-only' as const,
          headlessRunnerReady: true,
        })),
        startComposerSession: vi.fn(async () => {
          throw new Error('Request timed out')
        }),
      }),
    )

    const onFinalize = vi.fn()
    const { result } = renderSessionHook({
      seedBody: 'Fix login',
      workflow: 'default',
      autoStart: true,
      onFinalize,
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.retryableAction).toBe('start')
    })
  })

  it('retries start when the user invokes retry after a failed begin', async () => {
    let startCalls = 0
    installOrbitMock(
      createDefaultOrbitBridge({
        getComposerAssistCapabilities: vi.fn(async () => ({
          startMode: 'planning-only' as const,
          headlessRunnerReady: true,
        })),
        getActiveComposerSession: vi.fn(async () => null),
        startComposerSession: vi.fn(async () => {
          startCalls += 1
          if (startCalls === 1) {
            throw new Error('network error')
          }
          return {
            sessionId: 'composer_retry',
            question: 'Scope?',
            recommendedAnswer: 'Login',
            turnIndex: 1,
            readyToFinalize: false,
          }
        }),
      }),
    )

    const onFinalize = vi.fn()
    const { result } = renderSessionHook({
      seedBody: 'Fix login',
      workflow: 'default',
      autoStart: true,
      onFinalize,
    })

    await waitFor(() => {
      expect(result.current.retryableAction).toBe('start')
    })

    await act(async () => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.sessionId).toBe('composer_retry')
      expect(startCalls).toBe(2)
    })
  })

  it('surfaces session-expired on send when recovery fails', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getComposerAssistCapabilities: vi.fn(async () => ({
          startMode: 'interactive-assistant' as const,
          headlessRunnerReady: true,
        })),
        getActiveComposerSession: vi.fn(async () => null),
        startComposerSession: vi.fn(async () => ({
          sessionId: 'composer_expired',
          question: '',
          recommendedAnswer: '',
          assistantMessage: 'Hello',
          turnIndex: 0,
          readyToFinalize: false,
        })),
        messageComposerSession: vi.fn(async () => {
          throw new Error(composerSessionNotFoundMessage('composer_expired'))
        }),
        resumeComposerSession: vi.fn(async () => {
          throw new Error('resume failed')
        }),
      }),
    )

    const onFinalize = vi.fn()
    const { result } = renderSessionHook({
      seedBody: '',
      workflow: 'default',
      autoStart: true,
      onFinalize,
    })

    await waitFor(() => {
      expect(result.current.sessionId).toBe('composer_expired')
    })

    await act(async () => {
      await result.current.sendReply('follow up')
    })

    await waitFor(() => {
      expect(result.current.retryableAction).toBe('send')
      expect(result.current.error).toBeTruthy()
    })
  })

  it('appends localized Claude CLI guidance on low-signal send failures', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getComposerAssistCapabilities: vi.fn(async () => ({
          startMode: 'interactive-assistant' as const,
          headlessRunnerReady: true,
        })),
        getActiveComposerSession: vi.fn(async () => null),
        startComposerSession: vi.fn(async () => ({
          sessionId: 'composer_claude_guidance',
          question: '',
          recommendedAnswer: '',
          assistantMessage: 'Hello',
          turnIndex: 0,
          readyToFinalize: false,
        })),
        messageComposerSession: vi.fn(async () => {
          throw new Error('Claude CLI terminated by signal SIGTERM')
        }),
      }),
    )

    const onFinalize = vi.fn()
    const { result } = renderSessionHook({
      seedBody: '',
      workflow: 'default',
      autoStart: true,
      onFinalize,
    })

    await waitFor(() => {
      expect(result.current.sessionId).toBe('composer_claude_guidance')
    })

    await act(async () => {
      await result.current.sendReply('follow up')
    })

    await waitFor(() => {
      expect(result.current.error).toContain('Try these checks:')
      expect(result.current.error).toContain('claude --version')
    })
  })
})
