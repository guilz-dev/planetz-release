import { describe, expect, it } from 'vitest'
import { buildTaktTaskPrompt } from '../lib/build-takt-task-prompt.js'

describe('buildTaktTaskPrompt', () => {
  it('returns body only when title matches body (composer default)', () => {
    const text = 'issue #23 を実装して'
    expect(buildTaktTaskPrompt({ title: text, body: text })).toBe(text)
  })

  it('returns body only when title is the normalized first line', () => {
    const body = 'issue #23 を実装して\n\n追加の詳細'
    expect(buildTaktTaskPrompt({ title: 'issue #23 を実装して', body })).toBe(body)
  })

  it('combines title and body when title adds distinct context', () => {
    expect(
      buildTaktTaskPrompt({
        title: 'LLM summary',
        body: 'Longer instructions for the agent',
      }),
    ).toBe('LLM summary\n\nLonger instructions for the agent')
  })

  it('returns title when body is empty', () => {
    expect(buildTaktTaskPrompt({ title: 'Run now only', body: '' })).toBe('Run now only')
  })
})
