import { describe, expect, it } from 'vitest'
import {
  ghCliOutputLooksLikeAuthRequired,
  ghCliOutputLooksLikePermissionDenied,
} from '../lib/gh-cli-error-patterns.js'

describe('ghCliOutputLooksLikeAuthRequired', () => {
  it('returns false for unknown flag help that mentions assignee login', () => {
    const combined = `unknown flag: --json

flags:
  -a, --assignee login       assign people by their login.`.toLowerCase()
    expect(ghCliOutputLooksLikeAuthRequired(combined)).toBe(false)
  })

  it('returns true for explicit gh auth messages', () => {
    expect(ghCliOutputLooksLikeAuthRequired('authentication required: run gh auth login')).toBe(
      true,
    )
    expect(ghCliOutputLooksLikeAuthRequired('http 401: bad credentials')).toBe(true)
  })
})

describe('ghCliOutputLooksLikePermissionDenied', () => {
  it('returns true for 403 style messages', () => {
    expect(ghCliOutputLooksLikePermissionDenied('http 403: forbidden')).toBe(true)
  })
})
