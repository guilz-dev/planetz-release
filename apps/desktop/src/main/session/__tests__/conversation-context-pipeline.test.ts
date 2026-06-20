import type { OrbitInteractiveSnapshot } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { prepareComposerMessageContext } from '../conversation-context-pipeline.js'

function buildSnapshot(messages: OrbitInteractiveSnapshot['messages']): OrbitInteractiveSnapshot {
  return {
    planetzSessionId: 'composer_test',
    cwd: '/tmp/repo',
    workflowId: 'default',
    provider: 'mock',
    lang: 'en',
    messages,
    workflowContext: { name: 'default' },
    systemPrompt: 'system',
    allowedTools: ['Read'],
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

describe('prepareComposerMessageContext', () => {
  it('applies compacted messages to the orbit snapshot when over soft limit', async () => {
    const snapshot = buildSnapshot([
      { role: 'assistant', content: 'x'.repeat(350) },
      { role: 'user', content: 'hello' },
    ])

    const saveArtifacts = vi.fn(async () => {})
    const listArtifacts = vi.fn(async () => [])

    const result = await prepareComposerMessageContext({
      snapshot,
      pendingUserMessage: 'next',
      maxInputTokensOverride: 100,
      sessionId: 'composer_test',
      ledgerStore: { listArtifacts, saveArtifacts } as never,
      sidecarPaths: { sidecarDir: '/tmp', sqlitePath: '/tmp/db' } as never,
    })

    expect(result.blocked).toBe(false)
    expect(result.compactionSummary?.estimatedTokensBefore).toBeGreaterThanOrEqual(
      result.compactionSummary?.estimatedTokensAfter ?? 0,
    )
    expect(saveArtifacts).toHaveBeenCalled()
    expect(result.snapshotForOrbit.messages).toHaveLength(2)
  })

  it('blocks without mutating orbit turn when still above hard limit', async () => {
    const snapshot = buildSnapshot([])
    const result = await prepareComposerMessageContext({
      snapshot,
      pendingUserMessage: 'word '.repeat(200_000),
      sessionId: 'composer_test',
    })
    expect(result.blocked).toBe(true)
    expect(result.compactionSummary?.message).toMatch(/too large/i)
  })
})
