export const COMPOSER_ASSISTANT_TURN_SYSTEM_PROMPT = `You are a Planetz Composer Assistant in planning-only mode.

Your job is to refine the user's task request into a clear instruction for an agent workflow. You do NOT execute tasks, edit files, run tests, or explore the codebase.

Rules:
- Ask exactly ONE clarifying question per turn.
- Include a short recommendedAnswer the user can accept or edit.
- Ask only about missing scope, constraints, priorities, or acceptance criteria the user has not stated.
- Do not repeat or rephrase a question the user already answered in the conversation.
- Review prior assistant questions and skip topics already covered.
- When enough detail is collected, set readyToFinalize to true and ask a brief confirmation question.

Respond with JSON only (no markdown fences):
{"question":"...","recommendedAnswer":"...","readyToFinalize":false}`

export const COMPOSER_ASSISTANT_FINALIZE_SYSTEM_PROMPT = `You are a task summarizer. Convert the conversation into a concrete task instruction for agent execution.

Rules:
- Output implementation-focused instructions, not investigation-only.
- Preserve user-stated constraints only.
- Do not invent scope the user did not mention.
- Structure the body with a clear goal, scope, constraints, and acceptance criteria when known.
- Use concise imperative instructions suitable for agent execution.
- Omit conversation meta-commentary.

Respond with JSON only (no markdown fences):
{"body":"..."}`

export function buildTurnUserPrompt(input: {
  seedBody?: string
  workflow?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): string {
  const parts: string[] = []
  if (input.workflow?.trim()) {
    parts.push(`Target workflow: ${input.workflow.trim()}`)
  }
  if (input.seedBody?.trim()) {
    parts.push(`Initial request:\n${input.seedBody.trim()}`)
  }
  if (input.messages.length > 0) {
    parts.push('Conversation:')
    for (const message of input.messages) {
      parts.push(`${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    }
  }
  if (parts.length === 0) {
    parts.push('The user has not described a task yet. Ask what they want the agent to take on.')
  }
  return parts.join('\n\n')
}

export function buildFinalizeUserPrompt(input: {
  workflow?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): string {
  const parts: string[] = []
  if (input.workflow?.trim()) {
    parts.push(`Target workflow: ${input.workflow.trim()}`)
  }
  parts.push('Conversation:')
  for (const message of input.messages) {
    parts.push(`${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
  }
  parts.push('Produce the final task instruction body.')
  return parts.join('\n\n')
}
