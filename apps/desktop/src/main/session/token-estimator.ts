import {
  CONVERSATION_CONTEXT_MAX_INPUT_TOKENS_FALLBACK,
  CONVERSATION_CONTEXT_SOFT_LIMIT_RATIO,
} from '@planetz/shared'

/** Deterministic chars-per-token ratio for unsupported models (processing design §5.2.4). */
const FALLBACK_CHARS_PER_TOKEN = 4

const MODEL_MAX_INPUT_TOKENS: Record<string, number> = {
  'claude-sonnet-4': 200_000,
  'claude-opus-4': 200_000,
  'gpt-4.1': 1_047_576,
  'gpt-4o': 128_000,
}

export type TokenEstimateInput = {
  text: string
  model?: string
  maxInputTokensOverride?: number
}

export function resolveMaxInputTokens(model?: string, maxInputTokensOverride?: number): number {
  if (maxInputTokensOverride !== undefined && maxInputTokensOverride > 0) {
    return maxInputTokensOverride
  }
  const key = model?.trim()
  if (key && MODEL_MAX_INPUT_TOKENS[key] !== undefined) {
    return MODEL_MAX_INPUT_TOKENS[key]
  }
  return CONVERSATION_CONTEXT_MAX_INPUT_TOKENS_FALLBACK
}

export function resolveSoftLimit(maxInputTokens: number): number {
  return Math.floor(maxInputTokens * CONVERSATION_CONTEXT_SOFT_LIMIT_RATIO)
}

/** Approximate token count without external tokenizer libraries. */
export function estimateTokenCount(input: TokenEstimateInput): number {
  const chars = input.text.length
  if (chars === 0) return 0
  return Math.ceil(chars / FALLBACK_CHARS_PER_TOKEN)
}

export function estimateTokensForTexts(texts: string[], model?: string): number {
  return estimateTokenCount({ text: texts.join('\n'), model })
}
