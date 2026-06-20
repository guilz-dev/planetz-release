import { describe, expect, it } from 'vitest'
import {
  applyPersonaRowModeSwitch,
  snapshotPersonaRowDraft,
} from '../persona-provider-row-drafts.js'
import type { PersonaProviderRow } from '../persona-providers-form.js'

const STRUCTURED_ROW: PersonaProviderRow = {
  persona: 'coder',
  mode: 'structured',
  shorthand: '',
  provider: 'anthropic',
  model: 'claude',
  type: '',
  effort: 'high',
}

describe('persona provider row drafts', () => {
  it('preserves structured draft when switching to shorthand and back', () => {
    const snap = snapshotPersonaRowDraft(STRUCTURED_ROW)
    const shorthand = applyPersonaRowModeSwitch(snap, 'shorthand')
    shorthand.shorthand = 'openai'
    const back = applyPersonaRowModeSwitch({ ...shorthand, shorthandDraft: 'openai' }, 'structured')
    expect(back.provider).toBe('anthropic')
    expect(back.model).toBe('claude')
    expect(back.effort).toBe('high')
  })

  it('preserves shorthand draft when switching to structured and back', () => {
    const row: PersonaProviderRow = {
      persona: 'reviewer',
      mode: 'shorthand',
      shorthand: 'cursor',
      provider: '',
      model: '',
      type: '',
      effort: '',
      shorthandDraft: 'cursor',
    }
    const structured = applyPersonaRowModeSwitch(row, 'structured')
    structured.provider = 'codex'
    const snap = snapshotPersonaRowDraft(structured)
    const back = applyPersonaRowModeSwitch(snap, 'shorthand')
    expect(back.shorthand).toBe('cursor')
  })
})
