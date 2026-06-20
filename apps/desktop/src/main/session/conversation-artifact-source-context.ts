import type { OrbitInteractiveSnapshot } from '@planetz/shared'
import { normalizeComposerAssistSourceContext, redactSecrets } from '@planetz/shared'
import type { ConversationArtifactRow } from '../storage/sqlite/repositories/conversation-artifact-repository.js'

export type OrbitTokenCorpusMessage = { role: 'user' | 'assistant'; content: string }

const ATTACHED_CONTEXT_HEADING = '## Attached context'

function formatArtifactSection(row: ConversationArtifactRow): string {
  const body = row.payload_json?.trim() || `[${row.kind}] ${row.artifact_ref}`
  return `### ${row.kind}: ${row.artifact_ref}\n${body}`
}

/** Compiles ledger artifacts into orbit `sourceContext` (untrusted reference block). */
export function projectArtifactsToSourceContext(
  artifacts: ConversationArtifactRow[],
  baseSourceContext?: string,
): string | undefined {
  const sections: string[] = []
  const trimmedBase = baseSourceContext?.trim()
  if (trimmedBase) sections.push(trimmedBase)
  if (artifacts.length > 0) {
    sections.push(ATTACHED_CONTEXT_HEADING, ...artifacts.map(formatArtifactSection))
  }
  if (sections.length === 0) return undefined
  return normalizeComposerAssistSourceContext(redactSecrets(sections.join('\n\n')))
}

/**
 * Token corpus aligned with orbit input: projected `sourceContext` + messages + pending user text.
 * Artifact bodies are not counted separately when they are already compiled into `sourceContext`.
 */
export function buildOrbitAlignedTokenCorpus(input: {
  messages: OrbitTokenCorpusMessage[]
  pendingUserMessage: string
  artifacts: ConversationArtifactRow[]
  baseSourceContext?: string
  /** When true, prefixes each message line with role (compactor estimate path). */
  rolePrefixMessages?: boolean
}): string {
  const sourceContext = projectArtifactsToSourceContext(input.artifacts, input.baseSourceContext)
  const messageLines = input.rolePrefixMessages
    ? input.messages.map((message) => `${message.role}: ${message.content}`)
    : input.messages.map((message) => message.content)
  const parts = [sourceContext?.trim() ?? '', ...messageLines, input.pendingUserMessage.trim()]
  return parts.filter((part) => part.length > 0).join('\n')
}

export function applySourceContextToSnapshot(
  snapshot: OrbitInteractiveSnapshot,
  sourceContext: string | undefined,
): OrbitInteractiveSnapshot {
  if (!sourceContext?.trim()) {
    if (snapshot.sourceContext === undefined) return snapshot
    const { sourceContext: _removed, ...rest } = snapshot
    return { ...rest, updatedAt: new Date().toISOString() }
  }
  return {
    ...snapshot,
    sourceContext,
    updatedAt: new Date().toISOString(),
  }
}
