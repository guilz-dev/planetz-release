/** Stable substring; must match ComposerSessionNotFoundError message body. */
export const COMPOSER_SESSION_NOT_FOUND_SNIPPET = 'Composer session not found'

/** Prefix for errors where headless interactive cannot run; survives Electron IPC invoke wrapping. */
export const HEADLESS_INTERACTIVE_UNAVAILABLE_SNIPPET = 'HEADLESS_INTERACTIVE_UNAVAILABLE'

/** Stable substring when sourceContext is supplied but headless interactive cannot run. */
export const COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET =
  'COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE'

/** Context remains over hard token limit after compaction (P4). */
export const COMPOSER_CONTEXT_TOO_LARGE_SNIPPET = 'COMPOSER_CONTEXT_TOO_LARGE'
const CLAUDE_CLI_FAILURE_SNIPPET = 'Claude CLI failed ('
const CLAUDE_CLI_EXITED_WITH_CODE_SNIPPET = 'Claude CLI exited with code'
const CLAUDE_CLI_EXITED_WITHOUT_CODE_SNIPPET = 'Claude CLI exited without an exit code'
const CLAUDE_CLI_TERMINATED_BY_SIGNAL_SNIPPET = 'Claude CLI terminated by signal'

export interface ClaudeCliFailureGuidance {
  title: string
  checks: readonly string[]
}

export function composerSessionNotFoundMessage(sessionId: string): string {
  return `${COMPOSER_SESSION_NOT_FOUND_SNIPPET}: ${sessionId}`
}

export function headlessInteractiveUnavailableMessage(detail: string): string {
  return `${HEADLESS_INTERACTIVE_UNAVAILABLE_SNIPPET}: ${detail}`
}

export function composerSourceContextRequiresInteractiveMessage(): string {
  return `${COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET}: Source context requires interactive-assistant mode (headless runner is unavailable).`
}

/** True for main throws and Electron IPC-wrapped invoke errors. */
export function isComposerSessionNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(COMPOSER_SESSION_NOT_FOUND_SNIPPET)
}

const LEGACY_HEADLESS_UNAVAILABLE_SNIPPETS = [
  'orbit-interactive-session-runner.mjs not found',
  'PLANETZ_ORBIT_MODULE_ROOT is required',
  'Bundled orbit contract mismatch',
  'Invalid runner response',
] as const

/** True when headless interactive is unlikely to work; safe to fall back to planning-only. */
export function isHeadlessInteractiveUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.message.includes(HEADLESS_INTERACTIVE_UNAVAILABLE_SNIPPET)) return true
  return LEGACY_HEADLESS_UNAVAILABLE_SNIPPETS.some((snippet) => error.message.includes(snippet))
}

export function isComposerSourceContextRequiresInteractiveError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET)
  )
}

export function composerContextTooLargeMessage(detail?: string): string {
  const suffix = detail?.trim() ? `: ${detail.trim()}` : ''
  return `${COMPOSER_CONTEXT_TOO_LARGE_SNIPPET}: Conversation context exceeds the model limit after compaction${suffix}`
}

export function isComposerContextTooLargeError(error: unknown): error is Error {
  if (error instanceof Error && error.message.includes(COMPOSER_CONTEXT_TOO_LARGE_SNIPPET)) {
    return true
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'ComposerContextTooLargeError' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

export function isLowSignalClaudeCliFailureMessage(message: string | undefined): boolean {
  const value = message?.trim()
  if (!value) return false
  if (
    value.includes(CLAUDE_CLI_FAILURE_SNIPPET) &&
    value.includes(CLAUDE_CLI_EXITED_WITH_CODE_SNIPPET)
  ) {
    return true
  }
  return (
    value.includes(CLAUDE_CLI_EXITED_WITHOUT_CODE_SNIPPET) ||
    value.includes(CLAUDE_CLI_TERMINATED_BY_SIGNAL_SNIPPET)
  )
}

export function appendClaudeCliFailureGuidance(
  message: string,
  guidance?: ClaudeCliFailureGuidance,
): string {
  if (!isLowSignalClaudeCliFailureMessage(message)) return message
  if (!guidance?.title.trim()) return message
  if (message.includes(guidance.title)) return message
  const checks = guidance.checks.map((check) => check.trim()).filter((check) => check.length > 0)
  return [message, '', guidance.title.trim(), ...checks.map((check) => `- ${check}`)].join('\n')
}
