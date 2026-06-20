import type { RunEvent } from './types.js'

/** Max characters for run-event body text in execution log and activity previews. */
export const RUN_EVENT_CONTENT_PREVIEW_MAX = 500

export function truncateRunEventText(text: string, max = RUN_EVENT_CONTENT_PREVIEW_MAX): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

/** User-facing message for execution log and similar surfaces. */
export function formatRunEventDisplayMessage(event: RunEvent): string | undefined {
  const msg = event.message?.trim()
  const content = event.content?.trim()

  if (event.type === 'step_complete') {
    if (content) {
      const head = msg ? `step complete: ${msg}` : 'step complete'
      return `${head}\n${truncateRunEventText(content)}`
    }
    return msg
  }

  if (msg) {
    return msg.length > RUN_EVENT_CONTENT_PREVIEW_MAX ? truncateRunEventText(msg) : msg
  }

  return content ? truncateRunEventText(content) : undefined
}
