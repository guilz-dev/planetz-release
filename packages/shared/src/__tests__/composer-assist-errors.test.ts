import { describe, expect, it } from 'vitest'
import {
  appendClaudeCliFailureGuidance,
  COMPOSER_SESSION_NOT_FOUND_SNIPPET,
  COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET,
  composerSessionNotFoundMessage,
  composerSourceContextRequiresInteractiveMessage,
  HEADLESS_INTERACTIVE_UNAVAILABLE_SNIPPET,
  headlessInteractiveUnavailableMessage,
  isComposerSessionNotFoundError,
  isComposerSourceContextRequiresInteractiveError,
  isHeadlessInteractiveUnavailableError,
  isLowSignalClaudeCliFailureMessage,
} from '../composer-assist-errors.js'

describe('composer-assist-errors', () => {
  const guidance = {
    title: 'Try these checks:',
    checks: [
      'Run `claude --version` in the same workspace.',
      'Verify Claude Code is logged in and can run `claude -p --model haiku "ok"`.',
      'If needed, temporarily switch provider to `Claude (API)`.',
    ],
  } as const

  it('builds a stable not-found message', () => {
    expect(composerSessionNotFoundMessage('composer_abc')).toBe(
      `${COMPOSER_SESSION_NOT_FOUND_SNIPPET}: composer_abc`,
    )
  })

  it('detects not-found errors through Electron IPC wrapping', () => {
    const error = new Error(
      `Error invoking remote method 'composerSession:message': ComposerSessionNotFoundError: ${composerSessionNotFoundMessage('composer_abc')}`,
    )
    expect(isComposerSessionNotFoundError(error)).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isComposerSessionNotFoundError(new Error('network error'))).toBe(false)
    expect(isComposerSessionNotFoundError('not an error')).toBe(false)
  })

  it('detects headless runner unavailable errors via stable snippet', () => {
    const wrapped = new Error(
      `Error invoking remote method 'composerSession:start': ${headlessInteractiveUnavailableMessage('runner missing')}`,
    )
    expect(isHeadlessInteractiveUnavailableError(wrapped)).toBe(true)
    expect(wrapped.message).toContain(HEADLESS_INTERACTIVE_UNAVAILABLE_SNIPPET)
  })

  it('detects legacy headless runner messages', () => {
    expect(
      isHeadlessInteractiveUnavailableError(
        new Error('orbit-interactive-session-runner.mjs not found'),
      ),
    ).toBe(true)
  })

  it('returns false for generic assist errors', () => {
    expect(isHeadlessInteractiveUnavailableError(new Error('network error'))).toBe(false)
  })

  it('detects low-signal Claude CLI failures', () => {
    expect(
      isLowSignalClaudeCliFailureMessage('Claude CLI failed (1): Claude CLI exited with code 1'),
    ).toBe(true)
    expect(isLowSignalClaudeCliFailureMessage('Claude CLI exited without an exit code')).toBe(true)
    expect(isLowSignalClaudeCliFailureMessage('Claude CLI terminated by signal SIGTERM')).toBe(true)
    expect(isLowSignalClaudeCliFailureMessage('Claude CLI failed (1): error: unknown option')).toBe(
      false,
    )
  })

  it('appends actionable guidance to low-signal Claude CLI failures', () => {
    const message = appendClaudeCliFailureGuidance(
      'Claude CLI failed (1): Claude CLI exited with code 1',
      guidance,
    )
    expect(message).toContain('Try these checks:')
    expect(message).toContain('claude --version')
    expect(message).toContain('Claude (API)')
  })

  it('appends guidance for signal/no-exit-code low-signal failures', () => {
    const signalMessage = appendClaudeCliFailureGuidance(
      'Claude CLI terminated by signal SIGTERM',
      guidance,
    )
    expect(signalMessage).toContain('Try these checks:')
    const noExitCodeMessage = appendClaudeCliFailureGuidance(
      'Claude CLI exited without an exit code',
      guidance,
    )
    expect(noExitCodeMessage).toContain('Try these checks:')
  })

  it('keeps message unchanged without localized guidance input', () => {
    const source = 'Claude CLI failed (1): Claude CLI exited with code 1'
    expect(appendClaudeCliFailureGuidance(source)).toBe(source)
  })

  it('does not duplicate Claude CLI guidance', () => {
    const withGuidance = appendClaudeCliFailureGuidance(
      'Claude CLI failed (1): Claude CLI exited with code 1',
      guidance,
    )
    expect(appendClaudeCliFailureGuidance(withGuidance, guidance)).toBe(withGuidance)
  })

  it('detects sourceContext without headless interactive', () => {
    const message = composerSourceContextRequiresInteractiveMessage()
    expect(message).toContain(COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET)
    expect(isComposerSourceContextRequiresInteractiveError(new Error(message))).toBe(true)
  })
})
