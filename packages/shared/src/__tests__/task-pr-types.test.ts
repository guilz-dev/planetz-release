import { describe, expect, it } from 'vitest'
import { extractTaskPrErrorCode, formatTaskPrErrorMessage } from '../task-pr-types.js'

describe('task-pr-types', () => {
  it('formats and extracts task pr error codes', () => {
    const message = formatTaskPrErrorMessage('push_failed', 'remote rejected')
    expect(message).toBe('[task-pr:push_failed] remote rejected')
    expect(extractTaskPrErrorCode(new Error(message))).toBe('push_failed')
  })

  it('returns null for unrelated errors', () => {
    expect(extractTaskPrErrorCode(new Error('network down'))).toBeNull()
  })
})
