import { describe, expect, it } from 'vitest'
import { parseCodexDebugModelsOutput } from '../codex-debug-models-parser.js'

describe('parseCodexDebugModelsOutput', () => {
  it('parses slugs and display names from codex debug models JSON', () => {
    const models = parseCodexDebugModelsOutput(
      JSON.stringify({
        models: [
          { slug: 'gpt-5.3-codex', display_name: 'GPT-5.3-Codex', visibility: 'list' },
          { slug: 'gpt-5.5', display_name: 'GPT-5.5' },
        ],
      }),
    )

    expect(models).toEqual([
      { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
      { id: 'gpt-5.5', label: 'GPT-5.5' },
    ])
  })

  it('ignores invalid entries and de-duplicates by slug', () => {
    const models = parseCodexDebugModelsOutput(
      JSON.stringify({
        models: [
          { slug: 'gpt-5.4' },
          { slug: 'gpt-5.4', display_name: 'Duplicate' },
          { slug: 'codex-auto-review', visibility: 'hide' },
          { slug: 'Available models' },
          { slug: '' },
          { display_name: 'Missing slug' },
          null,
        ],
      }),
    )

    expect(models).toEqual([{ id: 'gpt-5.4' }])
  })

  it('returns empty array for malformed payload', () => {
    expect(parseCodexDebugModelsOutput('')).toEqual([])
    expect(parseCodexDebugModelsOutput('{invalid')).toEqual([])
    expect(parseCodexDebugModelsOutput('{}')).toEqual([])
  })
})
