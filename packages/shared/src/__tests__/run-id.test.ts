import { describe, expect, it } from 'vitest'
import { formatRunId, parseRunId } from '../run-id.js'

describe('runId', () => {
  it('formats and parses without collision across sessions', () => {
    const a = formatRunId('20260523-auth', 'sess-1')
    const b = formatRunId('20260523-auth', 'sess-2')
    expect(a).not.toBe(b)
    expect(parseRunId(a)).toEqual({ runDirSlug: '20260523-auth', sessionId: 'sess-1' })
    expect(parseRunId(b)).toEqual({ runDirSlug: '20260523-auth', sessionId: 'sess-2' })
  })

  it('returns null for invalid runId', () => {
    expect(parseRunId('no-colon')).toBeNull()
    expect(parseRunId(':only-right')).toBeNull()
  })
})
