import type {
  ConversationHistoryTurn,
  DecidedIntent,
  EngineConfig,
  IntentDraft,
} from '@planetz/shared'
import { z } from 'zod'
import { callOrbitProviderRaw } from './composer-llm-client.js'

const INTENT_DRAFT_SYSTEM_PROMPT = [
  'You help an operator draft a Decided Intent from a conversation.',
  'Return JSON only with keys: what, why, outOfScope.',
  'Use empty strings or an empty array when the conversation does not provide enough evidence.',
  'Do not invent facts that are not present in the conversation.',
].join(' ')

const intentDraftLlmOutputSchema = z.object({
  what: z.string().optional().default(''),
  why: z.string().optional().default(''),
  outOfScope: z.array(z.string()).optional().default([]),
})

function coerceJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonText = fenced ? fenced[1] : trimmed
  return JSON.parse(jsonText)
}

function stringifyTurns(turns: ConversationHistoryTurn[]): string {
  return turns
    .map((turn) => `${turn.role.toUpperCase()}(${turn.turnId}): ${turn.content}`)
    .join('\n\n')
}

function latestAssistantTurnId(turns: ConversationHistoryTurn[]): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index]?.role === 'assistant') return turns[index]?.turnId ?? null
  }
  return null
}

function normalizeOutOfScope(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')
}

function buildIntentDraftPrompt(input: {
  turns: ConversationHistoryTurn[]
  currentIntent: DecidedIntent | null
}): string {
  const currentIntentSection = input.currentIntent
    ? [
        `Current saved intent version: ${input.currentIntent.version}`,
        `Current what: ${input.currentIntent.what}`,
        `Current why: ${input.currentIntent.why}`,
        `Current outOfScope: ${input.currentIntent.outOfScope.join(', ')}`,
      ].join('\n')
    : 'Current saved intent: none'

  return [
    'Conversation turns:',
    stringifyTurns(input.turns),
    '',
    currentIntentSection,
    '',
    'Return JSON only:',
    '{"what":"...","why":"...","outOfScope":["..."]}',
  ].join('\n')
}

function parseIntentDraftOutput(raw: string) {
  return intentDraftLlmOutputSchema.parse(coerceJsonObject(raw))
}

async function callIntentDraftWithJsonRetry(input: {
  provider: string
  model?: string
  cwd: string
  prompt: string
  engineConfig: EngineConfig
}) {
  const retryPrompt = `${input.prompt}\n\nRespond with JSON only. No markdown fences or preamble.`
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await callOrbitProviderRaw({
        provider: input.provider,
        model: input.model,
        cwd: input.cwd,
        systemPrompt: INTENT_DRAFT_SYSTEM_PROMPT,
        prompt: attempt === 0 ? input.prompt : retryPrompt,
        engineConfig: input.engineConfig,
      })
      return parseIntentDraftOutput(response)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Intent draft generation failed')
}

export async function generateIntentDraftFromConversation(input: {
  threadId: string
  turns: ConversationHistoryTurn[]
  currentIntent: DecidedIntent | null
  existingDraft: IntentDraft | null
  provider: string
  model?: string
  cwd: string
  engineConfig: EngineConfig
  sourceTurnId?: string
}): Promise<IntentDraft | null> {
  const latestTurnId = latestAssistantTurnId(input.turns)
  if (!latestTurnId) return input.existingDraft
  if (input.sourceTurnId && input.sourceTurnId !== latestTurnId) return input.existingDraft

  const parsed = await callIntentDraftWithJsonRetry({
    provider: input.provider,
    model: input.model,
    cwd: input.cwd,
    prompt: buildIntentDraftPrompt({
      turns: input.turns,
      currentIntent: input.currentIntent,
    }),
    engineConfig: input.engineConfig,
  })
  const basedOnIntentVersion = input.currentIntent?.version ?? null
  return {
    threadId: input.threadId,
    autoGenerate: input.existingDraft?.autoGenerate ?? input.currentIntent === null,
    what: parsed.what.trim(),
    why: parsed.why.trim(),
    outOfScopeText: normalizeOutOfScope(parsed.outOfScope),
    sourceTurnId: latestTurnId,
    generatedAt: new Date().toISOString(),
    touchedByUser: input.existingDraft?.touchedByUser ?? false,
    basedOnIntentVersion,
  }
}
