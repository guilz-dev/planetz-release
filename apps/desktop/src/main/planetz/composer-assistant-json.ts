import { z } from 'zod'
import { parseJsonFromLlm, stripMarkdownJsonFence } from '../lib/parse-llm-json.js'

const assistantTurnJsonSchema = z.object({
  question: z.string().trim().min(1),
  recommendedAnswer: z.string().trim().min(1),
  readyToFinalize: z.boolean(),
})

const finalizeJsonSchema = z.object({
  body: z.string().trim().min(1),
})

export type AssistantTurnJson = z.infer<typeof assistantTurnJsonSchema>
export type FinalizeJson = z.infer<typeof finalizeJsonSchema>

export { stripMarkdownJsonFence }

export function parseAssistantTurnJson(content: string): AssistantTurnJson {
  return parseJsonFromLlm(content, assistantTurnJsonSchema)
}

export function parseFinalizeJson(content: string): FinalizeJson {
  return parseJsonFromLlm(content, finalizeJsonSchema)
}
