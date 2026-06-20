import {
  type ArtifactRef,
  CONTEXT_COMPACTOR_RECENT_TURNS_KEEP,
  CONTEXT_COMPACTOR_SUMMARY_SNIPPET_MAX_CHARS,
  type ConversationCompactionSummary,
} from '@planetz/shared'
import type { ConversationArtifactRow } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { artifactRefKey } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { buildOrbitAlignedTokenCorpus } from './conversation-artifact-source-context.js'
import { estimateTokenCount, resolveMaxInputTokens, resolveSoftLimit } from './token-estimator.js'

export type CompactionMessage = { role: 'user' | 'assistant'; content: string }

export type ContextCompactionInput = {
  messages: CompactionMessage[]
  pendingUserMessage: string
  artifacts: ConversationArtifactRow[]
  attachmentRefs?: ArtifactRef[]
  /** Issue/PR handoff block; artifacts are compiled into orbit `sourceContext` for estimates. */
  baseSourceContext?: string
  model?: string
  maxInputTokensOverride?: number
}

export type ContextCompactionResult = {
  messages: CompactionMessage[]
  artifacts: ConversationArtifactRow[]
  artifactPayloads: string[]
  estimatedTokensBefore: number
  estimatedTokensAfter: number
  summary: ConversationCompactionSummary
  blocked: boolean
}

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 }

function artifactText(row: ConversationArtifactRow): string {
  if (row.payload_json?.trim()) return row.payload_json
  return `[${row.kind}] ${row.artifact_ref}`
}

function summarizeAssistantBlock(messages: CompactionMessage[]): string {
  const lines = messages.map((m) => m.content.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  const joined = lines.join(' ')
  if (joined.length <= CONTEXT_COMPACTOR_SUMMARY_SNIPPET_MAX_CHARS) return joined
  return `${joined.slice(0, CONTEXT_COMPACTOR_SUMMARY_SNIPPET_MAX_CHARS - 1)}…`
}

function dedupeKey(row: ConversationArtifactRow): string {
  if (row.content_hash?.trim()) return row.content_hash.trim()
  const snippet = row.payload_json?.slice(0, 120) ?? row.artifact_ref
  return `${row.kind}:${row.artifact_ref}:${snippet}`
}

export function compactConversationContext(input: ContextCompactionInput): ContextCompactionResult {
  const maxInputTokens = resolveMaxInputTokens(input.model, input.maxInputTokensOverride)
  const hardLimit = maxInputTokens
  const softLimit = resolveSoftLimit(maxInputTokens)

  let messages = [...input.messages]
  let artifactRows = [...input.artifacts]
  let keptHighPriorityCount = 0
  let dedupedCount = 0
  let summarizedTurnCount = 0
  let droppedLowPriorityCount = 0

  const estimateCurrent = () =>
    estimateTokenCount({
      text: buildOrbitAlignedTokenCorpus({
        messages,
        pendingUserMessage: input.pendingUserMessage,
        artifacts: artifactRows,
        baseSourceContext: input.baseSourceContext,
        rolePrefixMessages: true,
      }),
      model: input.model,
    })

  const estimatedTokensBefore = estimateCurrent()

  const runCompaction = (): number => {
    const high = artifactRows.filter(
      (row) => row.priority === 'high' || row.kind === 'task' || row.kind === 'issue',
    )
    keptHighPriorityCount = high.length

    const seen = new Set<string>()
    const deduped: ConversationArtifactRow[] = []
    for (const row of artifactRows) {
      const key = dedupeKey(row)
      if (seen.has(key)) {
        dedupedCount += 1
        continue
      }
      seen.add(key)
      deduped.push(row)
    }
    artifactRows = deduped

    const assistantIndices = messages
      .map((m, index) => (m.role === 'assistant' ? index : -1))
      .filter((index) => index >= 0)
    const toSummarize = assistantIndices.slice(
      0,
      Math.max(0, assistantIndices.length - CONTEXT_COMPACTOR_RECENT_TURNS_KEEP),
    )
    if (toSummarize.length > 0) {
      const block = toSummarize
        .map((index) => messages[index])
        .filter(Boolean) as CompactionMessage[]
      const summaryText = summarizeAssistantBlock(block)
      const firstIndex = toSummarize[0]
      messages = messages.filter((_, index) => !toSummarize.includes(index))
      messages.splice(firstIndex, 0, {
        role: 'assistant',
        content: `[Summarized ${block.length} earlier assistant turns]\n${summaryText}`,
      })
      summarizedTurnCount = block.length
    }

    const sorted = [...artifactRows].sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority ?? 'normal'] ?? 1
      const pb = PRIORITY_RANK[b.priority ?? 'normal'] ?? 1
      return pb - pa
    })
    artifactRows = sorted.filter((row) => row.priority !== 'low')
    droppedLowPriorityCount = sorted.length - artifactRows.length

    return estimateCurrent()
  }

  let estimatedTokensAfter = estimatedTokensBefore
  if (estimatedTokensBefore >= softLimit) {
    estimatedTokensAfter = runCompaction()
    while (estimatedTokensAfter >= softLimit) {
      const removable = artifactRows.find((row) => row.priority !== 'high' && row.kind !== 'task')
      if (!removable) break
      artifactRows = artifactRows.filter((row) => row.artifact_id !== removable.artifact_id)
      droppedLowPriorityCount += 1
      estimatedTokensAfter = estimateCurrent()
    }
  }

  const blocked = estimatedTokensAfter >= hardLimit
  const summary: ConversationCompactionSummary = {
    estimatedTokensBefore,
    estimatedTokensAfter,
    keptHighPriorityCount,
    dedupedCount,
    summarizedTurnCount,
    droppedLowPriorityCount,
    message: blocked
      ? 'Context is still too large after compaction. Shorten your message or remove attachments.'
      : estimatedTokensBefore >= softLimit
        ? 'Older messages and duplicate artifacts were compacted to fit the model limit.'
        : 'Context within limits.',
  }

  const artifactPayloads = artifactRows.map(artifactText)
  if (input.attachmentRefs?.length) {
    for (const ref of input.attachmentRefs) {
      artifactPayloads.push(`[${ref.kind}] ${ref.ref}`)
    }
  }

  return {
    messages,
    artifacts: artifactRows,
    artifactPayloads,
    estimatedTokensBefore,
    estimatedTokensAfter,
    summary,
    blocked,
  }
}

export { artifactRefKey }
