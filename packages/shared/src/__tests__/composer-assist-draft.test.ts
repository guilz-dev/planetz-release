import { describe, expect, it } from 'vitest'
import { composerAssistDraftMatchesInput } from '../composer-assist-draft.js'

describe('composerAssistDraftMatchesInput', () => {
  it('matches when seed and workflow are the same after trim', () => {
    expect(
      composerAssistDraftMatchesInput(
        { seedBody: ' Fix login ', workflow: ' default ' },
        { seedBody: 'Fix login', workflow: 'default' },
      ),
    ).toBe(true)
  })

  it('matches when both sides omit seed and workflow', () => {
    expect(composerAssistDraftMatchesInput({}, {})).toBe(true)
  })

  it('rejects when workflow differs', () => {
    expect(composerAssistDraftMatchesInput({ workflow: 'default' }, { workflow: 'other' })).toBe(
      false,
    )
  })

  it('rejects when seed body differs', () => {
    expect(
      composerAssistDraftMatchesInput({ seedBody: 'Fix login' }, { seedBody: 'Fix auth' }),
    ).toBe(false)
  })

  it('rejects when sourceContext differs', () => {
    expect(
      composerAssistDraftMatchesInput(
        { sourceContext: '## Issue #1' },
        { sourceContext: '## Issue #2' },
      ),
    ).toBe(false)
  })

  it('rejects when provider differs', () => {
    expect(
      composerAssistDraftMatchesInput(
        { provider: 'copilot', model: 'gpt-5.3-codex' },
        { provider: 'cursor', model: 'gpt-5.3-codex' },
      ),
    ).toBe(false)
  })

  it('rejects when model differs for the same provider', () => {
    expect(
      composerAssistDraftMatchesInput(
        { provider: 'copilot', model: 'gpt-5.3-codex' },
        { provider: 'copilot', model: 'gpt-5.3-codex-high' },
      ),
    ).toBe(false)
  })

  it('rejects when sessionPolicy differs', () => {
    expect(
      composerAssistDraftMatchesInput(
        { sessionPolicy: 'planetz-chat-investigate' },
        { sessionPolicy: 'planetz-task-planning' },
      ),
    ).toBe(false)
  })

  it('matches when provider and model are the same after trim', () => {
    expect(
      composerAssistDraftMatchesInput(
        { provider: ' copilot ', model: ' gpt-5.3-codex ' },
        { provider: 'copilot', model: 'gpt-5.3-codex' },
      ),
    ).toBe(true)
  })
})
