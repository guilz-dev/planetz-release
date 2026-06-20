import { createHash } from 'node:crypto'

export function buildRoutingPromptHash(parts: { title?: string; body?: string }): string {
  const prompt = [parts.title, parts.body]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .trim()
  return createHash('sha256').update(prompt).digest('hex')
}
