import { CONVERSATION_CONTEXT_MAX_INPUT_TOKENS_FALLBACK } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { compactConversationContext } from '../context-compactor.js'
import { estimateTokenCount, resolveMaxInputTokens, resolveSoftLimit } from '../token-estimator.js'

describe('token-estimator', () => {
  it('uses model-specific limits when known', () => {
    expect(resolveMaxInputTokens('claude-sonnet-4')).toBeGreaterThan(
      CONVERSATION_CONTEXT_MAX_INPUT_TOKENS_FALLBACK,
    )
  })

  it('estimates tokens deterministically from character length', () => {
    expect(estimateTokenCount({ text: 'abcd' })).toBe(1)
    expect(estimateTokenCount({ text: 'a'.repeat(8) })).toBe(2)
  })
})

describe('context-compactor', () => {
  it('dedupes artifacts by content hash', () => {
    const result = compactConversationContext({
      messages: [{ role: 'assistant', content: 'context '.repeat(20_000) }],
      pendingUserMessage: 'Next',
      artifacts: [
        {
          artifact_id: 'a1',
          thread_id: 'thr',
          artifact_ref: 'log1',
          kind: 'log',
          priority: 'normal',
          content_hash: 'same',
          payload_json: 'line one',
        },
        {
          artifact_id: 'a2',
          thread_id: 'thr',
          artifact_ref: 'log2',
          kind: 'log',
          priority: 'normal',
          content_hash: 'same',
          payload_json: 'line two',
        },
      ],
    })
    expect(result.summary.dedupedCount).toBeGreaterThanOrEqual(1)
  })

  it('blocks when context stays above hard limit', () => {
    const huge = 'word '.repeat(200_000)
    const max = resolveMaxInputTokens()
    const soft = resolveSoftLimit(max)
    expect(soft).toBeLessThan(max)
    const result = compactConversationContext({
      messages: [],
      pendingUserMessage: huge,
      artifacts: [],
    })
    expect(result.blocked).toBe(true)
    expect(result.estimatedTokensAfter).toBeGreaterThanOrEqual(max)
  })
})
