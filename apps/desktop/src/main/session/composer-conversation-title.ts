import {
  CONVERSATION_TITLE_FALLBACK_MAX_CHARS,
  DEFAULT_CONVERSATION_THREAD_TITLE,
  type EngineConfig,
} from '@planetz/shared'
import { askComposerAssistantTurn } from '../planetz/composer-llm-client.js'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { truncateConversationTitle } from './composer-conversation-ledger.js'

const TITLE_GENERATION_SYSTEM =
  'Reply with only a short conversation title (max 8 words). No quotes or punctuation wrapping.'

export function fallbackConversationTitleFromUserMessage(userMessage: string): string {
  const normalized = userMessage.trim().replace(/\s+/g, ' ')
  if (!normalized) return DEFAULT_CONVERSATION_THREAD_TITLE
  if (normalized.length <= CONVERSATION_TITLE_FALLBACK_MAX_CHARS) return normalized
  return `${normalized.slice(0, CONVERSATION_TITLE_FALLBACK_MAX_CHARS)}…`
}

export async function generateConversationTitleViaLlm(input: {
  provider: string
  model?: string
  cwd: string
  userMessage: string
  assistantMessage: string
  engineConfig?: EngineConfig
}): Promise<string | null> {
  try {
    const turn = await askComposerAssistantTurn({
      provider: input.provider,
      model: input.model,
      cwd: input.cwd,
      messages: [
        {
          role: 'user',
          content: `${TITLE_GENERATION_SYSTEM}\n\nUser: ${input.userMessage}\nAssistant: ${input.assistantMessage}`,
        },
      ],
      engineConfig: input.engineConfig,
    })
    const candidate = turn.recommendedAnswer.trim() || turn.question.trim()
    if (!candidate) return null
    return truncateConversationTitle(candidate)
  } catch {
    return null
  }
}

export type ScheduleConversationTitleInput = {
  sessionId: string
  workspacePath: string
  userMessage: string
  assistantMessage: string
  ledgerStore?: ConversationLedgerStore
  requireSidecarPaths: () => SidecarPaths
  provider: string
  model?: string
  cwd: string
  loadEngineConfig: () => Promise<EngineConfig>
}

/** Fire-and-forget: updates ledger title once when still default (PLAN23 G3). */
export function scheduleConversationTitleGeneration(input: ScheduleConversationTitleInput): void {
  const ledgerStore = input.ledgerStore
  if (!ledgerStore) return
  void (async () => {
    try {
      const paths = input.requireSidecarPaths()
      const turnCount = await ledgerStore.countTurns(paths, input.sessionId)
      if (turnCount > 2) return

      const engineConfig = await input.loadEngineConfig()
      const generated = await generateConversationTitleViaLlm({
        provider: input.provider,
        model: input.model,
        cwd: input.cwd,
        userMessage: input.userMessage,
        assistantMessage: input.assistantMessage,
        engineConfig,
      })
      const title = generated ?? fallbackConversationTitleFromUserMessage(input.userMessage)
      const now = new Date().toISOString()
      await ledgerStore.updateTitleIfDefault(
        paths,
        input.sessionId,
        input.workspacePath,
        title,
        now,
      )
    } catch (error) {
      console.debug('conversation title generation failed', error)
    }
  })()
}
