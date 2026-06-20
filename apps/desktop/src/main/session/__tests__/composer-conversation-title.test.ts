import {
  CONVERSATION_TITLE_FALLBACK_MAX_CHARS,
  DEFAULT_CONVERSATION_THREAD_TITLE,
} from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  fallbackConversationTitleFromUserMessage,
  generateConversationTitleViaLlm,
  scheduleConversationTitleGeneration,
} from '../composer-conversation-title.js'

vi.mock('../../planetz/composer-llm-client.js', () => ({
  askComposerAssistantTurn: vi.fn(),
}))

import { askComposerAssistantTurn } from '../../planetz/composer-llm-client.js'

describe('composer-conversation-title', () => {
  it('truncates fallback title from user message', () => {
    const long = 'a'.repeat(CONVERSATION_TITLE_FALLBACK_MAX_CHARS + 20)
    const title = fallbackConversationTitleFromUserMessage(long)
    expect(title.length).toBeLessThanOrEqual(CONVERSATION_TITLE_FALLBACK_MAX_CHARS + 1)
    expect(title.endsWith('…')).toBe(true)
  })

  it('uses LLM output when generation succeeds', async () => {
    vi.mocked(askComposerAssistantTurn).mockResolvedValue({
      question: '',
      recommendedAnswer: 'Login validation fix',
      readyToFinalize: false,
    })
    const title = await generateConversationTitleViaLlm({
      provider: 'mock',
      cwd: '/tmp/repo',
      userMessage: 'Fix login',
      assistantMessage: 'Sure',
    })
    expect(title).toBe('Login validation fix')
  })

  it('returns null when LLM generation fails', async () => {
    vi.mocked(askComposerAssistantTurn).mockRejectedValue(new Error('timeout'))
    const title = await generateConversationTitleViaLlm({
      provider: 'mock',
      cwd: '/tmp/repo',
      userMessage: 'Fix login',
      assistantMessage: 'Sure',
    })
    expect(title).toBeNull()
  })

  it('updates title only for the first exchange', async () => {
    vi.mocked(askComposerAssistantTurn).mockResolvedValue({
      question: '',
      recommendedAnswer: 'Short title',
      readyToFinalize: false,
    })
    const updateTitleIfDefault = vi.fn(async () => true)
    const countTurns = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(4)

    scheduleConversationTitleGeneration({
      sessionId: 'composer_thr',
      workspacePath: '/tmp/ws',
      userMessage: 'Hello',
      assistantMessage: 'Hi',
      ledgerStore: { countTurns, updateTitleIfDefault } as never,
      requireSidecarPaths: () => ({ sidecarDir: '/tmp', sqlitePath: '/tmp/db' }) as never,
      provider: 'mock',
      cwd: '/tmp/repo',
      loadEngineConfig: async () => ({}),
    })

    await vi.waitFor(() => expect(updateTitleIfDefault).toHaveBeenCalledTimes(1))

    scheduleConversationTitleGeneration({
      sessionId: 'composer_thr',
      workspacePath: '/tmp/ws',
      userMessage: 'More',
      assistantMessage: 'Again',
      ledgerStore: { countTurns, updateTitleIfDefault } as never,
      requireSidecarPaths: () => ({ sidecarDir: '/tmp', sqlitePath: '/tmp/db' }) as never,
      provider: 'mock',
      cwd: '/tmp/repo',
      loadEngineConfig: async () => ({}),
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(updateTitleIfDefault).toHaveBeenCalledTimes(1)
  })

  it('falls back to user message when LLM returns empty', async () => {
    vi.mocked(askComposerAssistantTurn).mockResolvedValue({
      question: '',
      recommendedAnswer: '',
      readyToFinalize: false,
    })
    const updateTitleIfDefault = vi.fn(async () => true)
    const countTurns = vi.fn(async () => 2)

    scheduleConversationTitleGeneration({
      sessionId: 'composer_thr',
      workspacePath: '/tmp/ws',
      userMessage: 'First user line',
      assistantMessage: 'Reply',
      ledgerStore: { countTurns, updateTitleIfDefault } as never,
      requireSidecarPaths: () => ({ sidecarDir: '/tmp', sqlitePath: '/tmp/db' }) as never,
      provider: 'mock',
      cwd: '/tmp/repo',
      loadEngineConfig: async () => ({}),
    })

    await vi.waitFor(() =>
      expect(updateTitleIfDefault).toHaveBeenCalledWith(
        expect.anything(),
        'composer_thr',
        '/tmp/ws',
        'First user line',
        expect.any(String),
      ),
    )
  })

  it('keeps default title when user message is empty', () => {
    expect(fallbackConversationTitleFromUserMessage('   ')).toBe(DEFAULT_CONVERSATION_THREAD_TITLE)
  })

  it('swallows ledger errors without throwing', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const countTurns = vi.fn(async () => {
      throw new Error('db unavailable')
    })

    scheduleConversationTitleGeneration({
      sessionId: 'composer_thr',
      workspacePath: '/tmp/ws',
      userMessage: 'Hello',
      assistantMessage: 'Hi',
      ledgerStore: { countTurns, updateTitleIfDefault: vi.fn() } as never,
      requireSidecarPaths: () => ({ sidecarDir: '/tmp', sqlitePath: '/tmp/db' }) as never,
      provider: 'mock',
      cwd: '/tmp/repo',
      loadEngineConfig: async () => ({}),
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })
})
