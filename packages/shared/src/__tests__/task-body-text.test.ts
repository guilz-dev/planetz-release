import { describe, expect, it } from 'vitest'
import { hasTaskBodyContent, normalizeTaskBodyForSubmit } from '../task-body-text.js'

describe('task body text helpers', () => {
  it('normalizes undefined body to empty text', () => {
    expect(normalizeTaskBodyForSubmit(undefined)).toBe('')
  })

  it('treats whitespace-only body as empty', () => {
    expect(hasTaskBodyContent(' \n\t ')).toBe(false)
  })

  it('treats zero-width-only body as empty', () => {
    expect(hasTaskBodyContent('\u200B\u200C\u200D\u2060\uFEFF')).toBe(false)
  })

  it('accepts visible body content', () => {
    expect(hasTaskBodyContent('  investigate flaky ci  ')).toBe(true)
  })
})
