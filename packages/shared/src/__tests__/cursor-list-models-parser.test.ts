import { describe, expect, it } from 'vitest'
import { parseCursorListModelsOutput } from '../cursor-list-models-parser.js'

describe('parseCursorListModelsOutput', () => {
  it('parses id - label lines', () => {
    expect(
      parseCursorListModelsOutput(`auto - Auto
composer-2.5-fast - Composer 2.5 Fast (default)`),
    ).toEqual([
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2.5-fast', label: 'Composer 2.5 Fast (default)' },
    ])
  })

  it('dedupes by id and skips blank lines', () => {
    expect(parseCursorListModelsOutput('\nauto - Auto\nauto - Duplicate\n# comment\n')).toEqual([
      { id: 'auto', label: 'Auto' },
    ])
  })

  it('falls back to first token when no separator', () => {
    expect(parseCursorListModelsOutput('gpt-5-high')).toEqual([{ id: 'gpt-5-high' }])
  })

  it('skips heading/help lines from cursor-agent output', () => {
    expect(
      parseCursorListModelsOutput(`Available

auto - Auto
gpt-5.3-codex-high - Codex 5.3 High

Tip: use --model <id> to switch.`),
    ).toEqual([
      { id: 'auto', label: 'Auto' },
      { id: 'gpt-5.3-codex-high', label: 'Codex 5.3 High' },
    ])
  })

  it('treats uppercase headings as invalid ids', () => {
    expect(parseCursorListModelsOutput('Available')).toEqual([])
  })
})
