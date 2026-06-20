import { describe, expect, it } from 'vitest'
import { toErrorMessage } from '../to-error-message.js'

describe('toErrorMessage', () => {
  it('returns the first non-empty line from multiline Error messages', () => {
    expect(toErrorMessage(new Error('line one\nline two'), 'fallback')).toBe('line one')
  })

  it('returns fallback when error has no usable message', () => {
    expect(toErrorMessage(new Error('   \n  '), 'fallback')).toBe('fallback')
  })
})
