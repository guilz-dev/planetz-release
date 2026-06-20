import type { z } from 'zod'

/** Strip optional markdown JSON fences from model output. */
export function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()
  const inlineMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  if (inlineMatch?.[1]) return inlineMatch[1].trim()
  return trimmed
}

/** Ordered JSON text candidates extracted from a model response (most likely first). */
export function extractJsonObjectCandidates(content: string): string[] {
  const trimmed = content.trim()
  if (!trimmed) return []

  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (value: string) => {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    candidates.push(normalized)
  }

  push(stripMarkdownJsonFence(trimmed))

  const fenceBlocks: string[] = []
  const fenceRe = /```(?:json)?\s*\n?([\s\S]*?)```/gi
  let fenceMatch: RegExpExecArray | null = fenceRe.exec(trimmed)
  while (fenceMatch) {
    if (fenceMatch[1]?.trim()) fenceBlocks.push(fenceMatch[1].trim())
    fenceMatch = fenceRe.exec(trimmed)
  }
  for (let i = fenceBlocks.length - 1; i >= 0; i -= 1) {
    push(fenceBlocks[i]!)
  }

  const balanced = extractBalancedJsonObjects(trimmed)
  for (let i = balanced.length - 1; i >= 0; i -= 1) {
    push(balanced[i]!)
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    push(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return candidates
}

function extractBalancedJsonObjects(text: string): string[] {
  const objects: string[] = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '{') continue
    const slice = sliceBalancedJsonObject(text, i)
    if (slice) objects.push(slice)
  }
  return objects
}

function sliceBalancedJsonObject(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let j = start; j < text.length; j += 1) {
    const ch = text[j]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, j + 1)
    }
  }
  return null
}

export function parseJsonFromLlm<T>(content: string, schema: z.ZodType<T>): T {
  const candidates = extractJsonObjectCandidates(content)
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      return schema.parse(parsed)
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new SyntaxError('No JSON object found in LLM response')
}
