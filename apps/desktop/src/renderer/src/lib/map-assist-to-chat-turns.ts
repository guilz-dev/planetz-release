/**
 * Maps composer assist session shapes to {@link ChatTurn} for chat-style display.
 * Production chat reads turns from the conversation ledger; use this when bridging
 * assist snapshots (e.g. panel preview or future unified transcript views).
 */
import type { ComposerAssistActiveSession, ComposerAssistantTurn } from '@planetz/shared'
import type { ChatTurn } from '../components/chat/chat-types'

function isoNow(): string {
  return new Date().toISOString()
}

/** Maps a composer assist start turn into initial chat turns (seed + optional assistant). */
export function mapStartTurnToChatTurns(turn: ComposerAssistantTurn, seedBody: string): ChatTurn[] {
  const turns: ChatTurn[] = []
  const seed = seedBody.trim()
  if (seed) {
    turns.push({
      id: `${turn.sessionId}-u0`,
      role: 'user',
      content: seed,
      createdAt: isoNow(),
    })
  }
  const assistant = turn.assistantMessage?.trim()
  if (assistant) {
    turns.push({
      id: `${turn.sessionId}-a0`,
      role: 'assistant',
      content: assistant,
      createdAt: isoNow(),
    })
  }
  return turns
}

/** Maps planning-only Q/A rows to chat turns. */
export function mapAssistTurnsToChatTurns(
  sessionId: string,
  turns: ComposerAssistActiveSession['turns'],
): ChatTurn[] {
  const result: ChatTurn[] = []
  for (const [index, turn] of turns.entries()) {
    if (turn.userReply?.trim()) {
      result.push({
        id: `${sessionId}-u-${index}`,
        role: 'user',
        content: turn.userReply.trim(),
        createdAt: isoNow(),
      })
    }
    result.push({
      id: `${sessionId}-a-${index}`,
      role: 'assistant',
      content: turn.recommendedAnswer,
      createdAt: isoNow(),
    })
  }
  return result
}

/** Maps headless interactive conversation lines to chat turns. */
export function mapConversationLinesToChatTurns(
  sessionId: string,
  lines: NonNullable<ComposerAssistActiveSession['conversation']>,
): ChatTurn[] {
  return lines.map((line, index) => ({
    id: `${sessionId}-c-${index}`,
    role: line.role,
    content: line.content,
    createdAt: isoNow(),
  }))
}

/** Full assist session snapshot → chat transcript (summary preview excluded). */
export function mapAssistSessionToChatTurns(active: ComposerAssistActiveSession): ChatTurn[] {
  if (active.conversation && active.conversation.length > 0) {
    return mapConversationLinesToChatTurns(active.sessionId, active.conversation)
  }
  const seedTurns = active.seedBody?.trim()
    ? [
        {
          id: `${active.sessionId}-seed`,
          role: 'user' as const,
          content: active.seedBody.trim(),
          createdAt: isoNow(),
        },
      ]
    : []
  return [...seedTurns, ...mapAssistTurnsToChatTurns(active.sessionId, active.turns)]
}
