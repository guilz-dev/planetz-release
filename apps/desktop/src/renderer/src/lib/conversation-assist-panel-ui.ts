import type {
  ComposerAssistActiveSession,
  ComposerAssistantTurn,
  ComposerAssistConversationLine,
} from '@planetz/shared'
import type { Dispatch, SetStateAction } from 'react'

export interface AssistTurn {
  id: string
  question: string
  recommendedAnswer: string
  userReply?: string
}

export interface ConversationLine extends ComposerAssistConversationLine {
  id: string
}

export function mapAssistTurnsForPanel(
  sessionId: string,
  turns: ComposerAssistActiveSession['turns'],
): AssistTurn[] {
  return turns.map((turn, index) => ({
    id: `${sessionId}-${index + 1}`,
    question: turn.question,
    recommendedAnswer: turn.recommendedAnswer,
    userReply: turn.userReply,
  }))
}

/** Applies a composer start turn to panel conversation / Q&A state. */
export function applyAssistStartTurnUi(
  turn: ComposerAssistantTurn,
  seedBody: string,
  setters: {
    setConversation: Dispatch<SetStateAction<ConversationLine[]>>
    setTurns: Dispatch<SetStateAction<AssistTurn[]>>
    setReadyToFinalize: Dispatch<SetStateAction<boolean>>
  },
): void {
  const seed = seedBody.trim()
  const conv: ConversationLine[] = []
  if (seed) {
    conv.push({ id: `${turn.sessionId}-u0`, role: 'user', content: seed })
  }
  if (turn.assistantMessage?.trim()) {
    conv.push({
      id: `${turn.sessionId}-a0`,
      role: 'assistant',
      content: turn.assistantMessage,
    })
    setters.setConversation(conv)
    setters.setTurns([])
  } else if (turn.question?.trim()) {
    setters.setTurns([
      {
        id: `${turn.sessionId}-1`,
        question: turn.question,
        recommendedAnswer: turn.recommendedAnswer,
      },
    ])
    setters.setConversation([])
  } else {
    setters.setConversation(conv)
    setters.setTurns([])
  }
  setters.setReadyToFinalize(turn.readyToFinalize)
}
