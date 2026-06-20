import type { ConversationHistoryTurn, IntentDraft } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateIntentDraftFromConversation } from '../intent-draft-generator.js'

const { callOrbitProviderRawMock } = vi.hoisted(() => ({
  callOrbitProviderRawMock: vi.fn(),
}))

vi.mock('../composer-llm-client.js', () => ({
  callOrbitProviderRaw: callOrbitProviderRawMock,
}))

describe('generateIntentDraftFromConversation', () => {
  const turns: ConversationHistoryTurn[] = [
    {
      turnId: 'turn-user-1',
      role: 'user',
      content: 'We need stronger retry behavior.',
      createdAt: '2026-06-16T00:00:00.000Z',
    },
    {
      turnId: 'turn-assistant-1',
      role: 'assistant',
      content: 'Understood. I will focus on retry policies.',
      createdAt: '2026-06-16T00:00:10.000Z',
    },
  ]

  beforeEach(() => {
    callOrbitProviderRawMock.mockReset()
  })

  it('skips generation when sourceTurnId is stale', async () => {
    const existingDraft: IntentDraft = {
      threadId: 'thread-1',
      autoGenerate: true,
      what: 'Existing what',
      why: 'Existing why',
      outOfScopeText: '',
      touchedByUser: false,
      basedOnIntentVersion: null,
      sourceTurnId: 'turn-assistant-1',
      generatedAt: '2026-06-16T00:00:10.000Z',
    }

    const draft = await generateIntentDraftFromConversation({
      threadId: 'thread-1',
      turns,
      currentIntent: null,
      existingDraft,
      provider: 'claude-sdk',
      cwd: '/tmp/repo',
      engineConfig: {},
      sourceTurnId: 'turn-assistant-older',
    })

    expect(draft).toEqual(existingDraft)
    expect(callOrbitProviderRawMock).not.toHaveBeenCalled()
  })

  it('returns normalized draft from llm json output', async () => {
    callOrbitProviderRawMock.mockResolvedValueOnce(
      JSON.stringify({
        what: ' Stabilize payment retries ',
        why: ' Reduce checkout failures ',
        outOfScope: [' UI redesign ', ''],
      }),
    )

    const draft = await generateIntentDraftFromConversation({
      threadId: 'thread-2',
      turns,
      currentIntent: null,
      existingDraft: null,
      provider: 'claude-sdk',
      model: 'model-x',
      cwd: '/tmp/repo',
      engineConfig: {},
      sourceTurnId: 'turn-assistant-1',
    })

    expect(draft).toMatchObject({
      threadId: 'thread-2',
      autoGenerate: true,
      what: 'Stabilize payment retries',
      why: 'Reduce checkout failures',
      outOfScopeText: 'UI redesign',
      sourceTurnId: 'turn-assistant-1',
      touchedByUser: false,
      basedOnIntentVersion: null,
    })
  })

  it('retries once with JSON-only prompt when first response is invalid', async () => {
    callOrbitProviderRawMock.mockResolvedValueOnce('not-json-response').mockResolvedValueOnce(
      JSON.stringify({
        what: 'Retry policy draft',
        why: 'Avoid flaky parsing',
        outOfScope: [],
      }),
    )

    const draft = await generateIntentDraftFromConversation({
      threadId: 'thread-3',
      turns,
      currentIntent: null,
      existingDraft: null,
      provider: 'claude-sdk',
      cwd: '/tmp/repo',
      engineConfig: {},
      sourceTurnId: 'turn-assistant-1',
    })

    expect(draft?.what).toBe('Retry policy draft')
    expect(callOrbitProviderRawMock).toHaveBeenCalledTimes(2)
    expect(callOrbitProviderRawMock.mock.calls[1]?.[0]).toMatchObject({
      prompt: expect.stringContaining('Respond with JSON only. No markdown fences or preamble.'),
    })
  })
})
