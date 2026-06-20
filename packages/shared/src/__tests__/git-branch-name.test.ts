import { describe, expect, it } from 'vitest'
import { isValidGitBranchName } from '../git-branch-name.js'

describe('isValidGitBranchName', () => {
  it('accepts typical branch names', () => {
    expect(isValidGitBranchName('main')).toBe(true)
    expect(isValidGitBranchName('feature/123-foo')).toBe(true)
  })

  it('rejects empty and traversal-like names', () => {
    expect(isValidGitBranchName('')).toBe(false)
    expect(isValidGitBranchName('  ')).toBe(false)
    expect(isValidGitBranchName('foo..bar')).toBe(false)
    expect(isValidGitBranchName('../escape')).toBe(false)
  })

  it('rejects ref metacharacters and whitespace', () => {
    expect(isValidGitBranchName('-leading')).toBe(false)
    expect(isValidGitBranchName('has space')).toBe(false)
    expect(isValidGitBranchName('foo@{bar}')).toBe(false)
    expect(isValidGitBranchName('ends.with.')).toBe(false)
    expect(isValidGitBranchName('has#hash')).toBe(false)
    expect(isValidGitBranchName('pct%')).toBe(false)
  })
})
