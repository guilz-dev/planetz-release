import { describe, expect, it } from 'vitest'
import { parseOllamaTagsResponse } from '../ollama-tags.js'

describe('parseOllamaTagsResponse', () => {
  it('parses model names from tags payload', () => {
    const models = parseOllamaTagsResponse({
      models: [
        { name: 'llama3.2:latest', details: { parameter_size: '3B' } },
        { name: 'qwen2.5:7b' },
      ],
    })
    expect(models).toEqual([{ id: 'llama3.2:latest', label: '3B' }, { id: 'qwen2.5:7b' }])
  })

  it('returns empty for invalid payload', () => {
    expect(parseOllamaTagsResponse(null)).toEqual([])
    expect(parseOllamaTagsResponse({})).toEqual([])
  })
})
