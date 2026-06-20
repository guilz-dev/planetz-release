const INVISIBLE_TASK_BODY_CHARS = /(?:[\s\u200B]|\u200C|\u200D|\u2060|\uFEFF)/gu

/** Trims user input before enqueue/run submission. */
export function normalizeTaskBodyForSubmit(raw: string | undefined): string {
  return raw?.trim() ?? ''
}

/** True when the prompt contains non-whitespace, visible content. */
export function hasTaskBodyContent(raw: string | undefined): boolean {
  const normalized = normalizeTaskBodyForSubmit(raw)
  return normalized.replace(INVISIBLE_TASK_BODY_CHARS, '').length > 0
}
