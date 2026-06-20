import { describe, expect, it } from 'vitest'
import {
  parseAssistantTurnJson,
  parseFinalizeJson,
  stripMarkdownJsonFence,
} from '../planetz/composer-assistant-json.js'

describe('composer-assistant-json', () => {
  it('strips markdown json fences', () => {
    expect(stripMarkdownJsonFence('```json\n{"question":"Q"}\n```')).toBe('{"question":"Q"}')
  })

  it('parses assistant turn json', () => {
    const parsed = parseAssistantTurnJson(
      '{"question":"What scope?","recommendedAnswer":"Fix login","readyToFinalize":false}',
    )
    expect(parsed.question).toBe('What scope?')
    expect(parsed.recommendedAnswer).toBe('Fix login')
    expect(parsed.readyToFinalize).toBe(false)
  })

  it('parses finalize json', () => {
    const parsed = parseFinalizeJson('{"body":"Implement feature X"}')
    expect(parsed.body).toBe('Implement feature X')
  })
})
