import { describe, expect, it } from 'vitest'
import { isWorkspaceNotFoundError } from '../workspace-switch-errors.js'

describe('isWorkspaceNotFoundError', () => {
  it('matches main-process workspace open failures', () => {
    expect(isWorkspaceNotFoundError(new Error('Workspace not found: /gone'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isWorkspaceNotFoundError(new Error('disk full'))).toBe(false)
    expect(isWorkspaceNotFoundError('Workspace not found')).toBe(false)
  })
})
