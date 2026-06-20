import type {
  ArtifactRef,
  ConversationCompactionSummary,
  OrbitInteractiveSnapshot,
} from '@planetz/shared'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { ConversationArtifactRow } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { artifactRefKey } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { type CompactionMessage, compactConversationContext } from './context-compactor.js'
import {
  applySourceContextToSnapshot,
  buildOrbitAlignedTokenCorpus,
  projectArtifactsToSourceContext,
} from './conversation-artifact-source-context.js'

/** Re-export for callers/tests that treat the pipeline as the context projection entry. */
export { projectArtifactsToSourceContext } from './conversation-artifact-source-context.js'

import { estimateTokenCount, resolveMaxInputTokens, resolveSoftLimit } from './token-estimator.js'

export type PrepareComposerMessageContextInput = {
  snapshot: OrbitInteractiveSnapshot
  pendingUserMessage: string
  attachments?: ArtifactRef[]
  model?: string
  maxInputTokensOverride?: number
  sessionId: string
  ledgerStore?: ConversationLedgerStore
  sidecarPaths?: SidecarPaths
}

export type PrepareComposerMessageContextResult = {
  blocked: boolean
  compactionSummary?: ConversationCompactionSummary
  messageForOrbit: string
  snapshotForOrbit: OrbitInteractiveSnapshot
}

function snapshotToMessages(snapshot: OrbitInteractiveSnapshot): CompactionMessage[] {
  return snapshot.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function applyMessagesToSnapshot(
  snapshot: OrbitInteractiveSnapshot,
  messages: CompactionMessage[],
): OrbitInteractiveSnapshot {
  return {
    ...snapshot,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    updatedAt: new Date().toISOString(),
  }
}

async function persistCompactionSummaryArtifact(
  ledgerStore: ConversationLedgerStore,
  paths: SidecarPaths,
  sessionId: string,
  summary: ConversationCompactionSummary,
): Promise<void> {
  const ref = `compaction-${sessionId}`
  const artifact: ArtifactRef = { kind: 'summary', ref, priority: 'high' }
  const key = artifactRefKey(artifact)
  await ledgerStore.saveArtifacts(
    paths,
    sessionId,
    [artifact],
    new Map([[key, JSON.stringify(summary)]]),
  )
}

export async function prepareComposerMessageContext(
  input: PrepareComposerMessageContextInput,
): Promise<PrepareComposerMessageContextResult> {
  const messages = snapshotToMessages(input.snapshot)
  let artifacts: ConversationArtifactRow[] = []
  if (input.ledgerStore && input.sidecarPaths) {
    artifacts = await input.ledgerStore.listArtifacts(input.sidecarPaths, input.sessionId)
    if (input.attachments?.length) {
      await input.ledgerStore.saveArtifacts(input.sidecarPaths, input.sessionId, input.attachments)
      artifacts = await input.ledgerStore.listArtifacts(input.sidecarPaths, input.sessionId)
    }
  }

  const projectedSourceContext = projectArtifactsToSourceContext(
    artifacts,
    input.snapshot.sourceContext,
  )

  const maxInputTokens = resolveMaxInputTokens(input.model, input.maxInputTokensOverride)
  const softLimit = resolveSoftLimit(maxInputTokens)
  const corpusBefore = buildOrbitAlignedTokenCorpus({
    messages,
    pendingUserMessage: input.pendingUserMessage,
    artifacts,
    baseSourceContext: input.snapshot.sourceContext,
  })
  const tokensBefore = estimateTokenCount({ text: corpusBefore, model: input.model })

  const snapshotWithSourceContext = applySourceContextToSnapshot(
    input.snapshot,
    projectedSourceContext,
  )

  if (tokensBefore < softLimit) {
    return {
      blocked: false,
      messageForOrbit: input.pendingUserMessage,
      snapshotForOrbit: snapshotWithSourceContext,
    }
  }

  const compacted = compactConversationContext({
    messages,
    pendingUserMessage: input.pendingUserMessage,
    artifacts,
    attachmentRefs: input.attachments,
    baseSourceContext: input.snapshot.sourceContext,
    model: input.model,
    maxInputTokensOverride: input.maxInputTokensOverride,
  })

  if (input.ledgerStore && input.sidecarPaths) {
    await persistCompactionSummaryArtifact(
      input.ledgerStore,
      input.sidecarPaths,
      input.sessionId,
      compacted.summary,
    )
  }

  const compactedSourceContext = projectArtifactsToSourceContext(
    compacted.artifacts,
    input.snapshot.sourceContext,
  )
  const snapshotForOrbit = applySourceContextToSnapshot(
    applyMessagesToSnapshot(input.snapshot, compacted.messages),
    compactedSourceContext,
  )

  if (compacted.blocked) {
    return {
      blocked: true,
      compactionSummary: compacted.summary,
      messageForOrbit: input.pendingUserMessage,
      snapshotForOrbit,
    }
  }

  return {
    blocked: false,
    compactionSummary: compacted.summary,
    messageForOrbit: input.pendingUserMessage,
    snapshotForOrbit,
  }
}
