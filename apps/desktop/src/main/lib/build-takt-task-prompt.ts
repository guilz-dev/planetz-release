import type { EnqueueTaskInput } from '@planetz/shared'
import { normalizeEnqueueTitle } from './title-generator.js'

/**
 * Text passed to `takt add` / `takt --task`. `body` is the order; `title` is UI metadata.
 * Combine only when the title adds context not already present at the start of the body.
 */
export function buildTaktTaskPrompt(input: Pick<EnqueueTaskInput, 'title' | 'body'>): string {
  const body = input.body?.trim() ?? ''
  const title = normalizeEnqueueTitle(input.title ?? '')
  if (!body) return title
  if (!title) return body
  if (title === body) return body
  const firstLine = normalizeEnqueueTitle(body.split(/\r?\n/, 1)[0] ?? '')
  if (title === firstLine) return body
  return `${title}\n\n${body}`
}
