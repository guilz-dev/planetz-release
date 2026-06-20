import { describe, expect, it } from 'vitest'
import { parseGitUnifiedDiff } from '../lib/git-unified-diff-parser.js'

describe('parseGitUnifiedDiff', () => {
  it('parses hunk lines with old/new numbers', () => {
    const raw = [
      'diff --git a/file.txt b/file.txt',
      'index 111..222 100644',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,3 +1,4 @@',
      ' line-a',
      '-line-b',
      '+line-b2',
      '+line-c',
    ].join('\n')

    const parsed = parseGitUnifiedDiff(raw, 10_000)
    expect(parsed.truncated).toBe(false)
    expect(parsed.lines).toEqual([
      { kind: 'meta', text: 'diff --git a/file.txt b/file.txt' },
      { kind: 'meta', text: 'index 111..222 100644' },
      { kind: 'meta', text: '--- a/file.txt' },
      { kind: 'meta', text: '+++ b/file.txt' },
      { kind: 'hunk', text: '@@ -1,3 +1,4 @@' },
      { kind: 'context', oldNo: 1, newNo: 1, text: 'line-a' },
      { kind: 'del', oldNo: 2, text: 'line-b' },
      { kind: 'add', newNo: 2, text: 'line-b2' },
      { kind: 'add', newNo: 3, text: 'line-c' },
    ])
  })

  it('flags truncation when byte cap is exceeded', () => {
    const parsed = parseGitUnifiedDiff('@@ -1 +1 @@\n+abcdef', 5)
    expect(parsed.truncated).toBe(true)
    expect(parsed.lines.length).toBeGreaterThanOrEqual(1)
  })

  it('preserves no-newline marker as meta', () => {
    const parsed = parseGitUnifiedDiff(
      ['@@ -1 +1 @@', '-old', '+new', '\\ No newline at end of file'].join('\n'),
      10_000,
    )
    expect(parsed.lines.at(-1)).toEqual({
      kind: 'meta',
      text: '\\ No newline at end of file',
    })
  })
})
