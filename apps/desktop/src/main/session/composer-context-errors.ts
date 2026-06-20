import {
  COMPOSER_CONTEXT_TOO_LARGE_SNIPPET,
  type ConversationCompactionSummary,
} from '@planetz/shared'

export class ComposerContextTooLargeError extends Error {
  readonly summary: ConversationCompactionSummary

  constructor(summary: ConversationCompactionSummary) {
    super(`${COMPOSER_CONTEXT_TOO_LARGE_SNIPPET}: ${summary.message}`)
    this.name = 'ComposerContextTooLargeError'
    this.summary = summary
  }
}

export function isComposerContextTooLargeError(
  error: unknown,
): error is ComposerContextTooLargeError {
  return error instanceof ComposerContextTooLargeError
}
