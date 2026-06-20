import type { OrbitInteractiveSnapshot } from '@planetz/shared'
import {
  COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS,
  CONVERSATION_CONTEXT_SOFT_LIMIT_RATIO,
} from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  applySourceContextToSnapshot,
  buildOrbitAlignedTokenCorpus,
  projectArtifactsToSourceContext,
} from '../conversation-artifact-source-context.js'
import { prepareComposerMessageContext } from '../conversation-context-pipeline.js'
import { estimateTokenCount, resolveMaxInputTokens, resolveSoftLimit } from '../token-estimator.js'

function buildSnapshot(
  messages: OrbitInteractiveSnapshot['messages'],
  sourceContext?: string,
): OrbitInteractiveSnapshot {
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
    ...(sourceContext ? { sourceContext } : {}),
  }
}

describe('projectArtifactsToSourceContext', () => {
  it('reflects artifact payloads in sourceContext', () => {
    const projected = projectArtifactsToSourceContext([
      {
        artifact_id: 'a1',
        thread_id: 'thr',
        artifact_ref: 'task:42',
        kind: 'task',
        priority: 'high',
        content_hash: null,
        payload_json: 'Fix the login flow',
      },
    ])
    expect(projected).toContain('task:42')
    expect(projected).toContain('Fix the login flow')
  })

  it('redacts secrets and truncates oversized context', () => {
    const secretBody = 'key=sk-abcdefghijklmnopqrstuvwxyz'
    const projected = projectArtifactsToSourceContext([
      {
        artifact_id: 'a1',
        thread_id: 'thr',
        artifact_ref: 'log:run',
        kind: 'log',
        priority: 'normal',
        content_hash: null,
        payload_json: secretBody,
      },
    ])
    expect(projected).not.toContain('sk-abcdefghijklmnopqrstuvwxyz')
    expect(projected).toContain('[REDACTED]')

    const oversized = 'z'.repeat(COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS + 500)
    const truncated = projectArtifactsToSourceContext([], oversized)
    expect(truncated?.length).toBeLessThanOrEqual(COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS + 64)
    expect(truncated).toContain('truncated')
  })
})

describe('buildOrbitAlignedTokenCorpus', () => {
  it('does not double-count artifact payloads already compiled into sourceContext', () => {
    const artifacts = [
      {
        artifact_id: 'a1',
        thread_id: 'thr',
        artifact_ref: 'file:README.md',
        kind: 'file' as const,
        priority: 'normal' as const,
        content_hash: null,
        payload_json: 'x'.repeat(400),
      },
    ]
    const messages = [{ role: 'user' as const, content: 'hello' }]
    const corpus = buildOrbitAlignedTokenCorpus({
      messages,
      pendingUserMessage: 'next',
      artifacts,
    })
    const withDuplicateArtifacts = [
      projectArtifactsToSourceContext(artifacts) ?? '',
      ...messages.map((m) => m.content),
      ...artifacts.map((row) => row.payload_json ?? ''),
      'next',
    ]
      .filter((part) => part.length > 0)
      .join('\n')
    expect(estimateTokenCount({ text: corpus })).toBeLessThan(
      estimateTokenCount({ text: withDuplicateArtifacts }),
    )
  })
})

describe('prepareComposerMessageContext sourceContext', () => {
  it('includes artifacts in sourceContext on the orbit snapshot', async () => {
    const snapshot = buildSnapshot([{ role: 'user', content: 'hello' }])
    const listArtifacts = vi.fn(async () => [
      {
        artifact_id: 'a1',
        thread_id: 'thr',
        artifact_ref: 'issue:9',
        kind: 'issue',
        priority: 'high',
        content_hash: null,
        payload_json: '## Issue #9',
      },
    ])

    const result = await prepareComposerMessageContext({
      snapshot,
      pendingUserMessage: 'next',
      maxInputTokensOverride: 10_000,
      sessionId: 'composer_test',
      ledgerStore: { listArtifacts, saveArtifacts: vi.fn() } as never,
      sidecarPaths: { sidecarDir: '/tmp', sqlitePath: '/tmp/db' } as never,
    })

    expect(result.snapshotForOrbit.sourceContext).toContain('issue:9')
    expect(result.snapshotForOrbit.sourceContext).toContain('## Issue #9')
  })

  it('triggers compaction when sourceContext pushes corpus over soft limit', async () => {
    const maxInputTokens = 100
    const softLimit = resolveSoftLimit(maxInputTokens)
    const baseContext = 'c'.repeat(softLimit * 4)
    const snapshot = buildSnapshot([], baseContext)
    const listArtifacts = vi.fn(async () => [])

    const result = await prepareComposerMessageContext({
      snapshot,
      pendingUserMessage: 'tiny',
      maxInputTokensOverride: maxInputTokens,
      sessionId: 'composer_test',
      ledgerStore: { listArtifacts, saveArtifacts: vi.fn() } as never,
      sidecarPaths: { sidecarDir: '/tmp', sqlitePath: '/tmp/db' } as never,
    })

    expect(result.compactionSummary).toBeDefined()
    expect(result.compactionSummary?.estimatedTokensBefore).toBeGreaterThanOrEqual(softLimit)
  })

  it('counts snapshot sourceContext toward soft-limit token estimate', async () => {
    const maxInputTokens = 80
    const softLimit = resolveSoftLimit(maxInputTokens)
    const contextOnly = 'w'.repeat(softLimit * 4)
    const tokensWithContext = estimateTokenCount({ text: contextOnly })
    expect(tokensWithContext).toBeGreaterThanOrEqual(softLimit)

    const withoutContext = await prepareComposerMessageContext({
      snapshot: buildSnapshot([]),
      pendingUserMessage: 'ok',
      maxInputTokensOverride: maxInputTokens,
      sessionId: 'composer_test',
    })
    expect(withoutContext.compactionSummary).toBeUndefined()

    const saveArtifacts = vi.fn(async () => {})
    const listArtifacts = vi.fn(async () => [])
    const withContext = await prepareComposerMessageContext({
      snapshot: buildSnapshot([], contextOnly),
      pendingUserMessage: 'ok',
      maxInputTokensOverride: maxInputTokens,
      sessionId: 'composer_test',
      ledgerStore: { listArtifacts, saveArtifacts } as never,
      sidecarPaths: { sidecarDir: '/tmp', sqlitePath: '/tmp/db' } as never,
    })
    expect(withContext.compactionSummary).toBeDefined()
    expect(resolveMaxInputTokens(undefined, maxInputTokens)).toBe(maxInputTokens)
    expect(CONVERSATION_CONTEXT_SOFT_LIMIT_RATIO).toBeLessThan(1)
    expect(applySourceContextToSnapshot(buildSnapshot([]), 'ctx').sourceContext).toBe('ctx')
  })
})
