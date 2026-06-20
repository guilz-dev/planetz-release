import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { extractJsonObjectCandidates, parseJsonFromLlm } from '../lib/parse-llm-json.js'

const sampleSchema = z.object({
  intent: z.array(z.string()),
  mayModifyCode: z.boolean(),
})

describe('parseJsonFromLlm', () => {
  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseJsonFromLlm(
      'Here is the result:\n```json\n{"intent":["investigate"],"mayModifyCode":false}\n```\nThanks.',
      sampleSchema,
    )
    expect(parsed.intent).toEqual(['investigate'])
  })

  it('parses JSON with preamble and postamble via brace extraction', () => {
    const parsed = parseJsonFromLlm(
      'Analysis complete.\n{"intent":["review"],"mayModifyCode":true}\nEnd.',
      sampleSchema,
    )
    expect(parsed.intent).toEqual(['review'])
    expect(parsed.mayModifyCode).toBe(true)
  })

  it('prefers the last balanced JSON object when multiple appear', () => {
    const parsed = parseJsonFromLlm(
      '{"intent":["implement"],"mayModifyCode":true} noise {"intent":["investigate"],"mayModifyCode":false}',
      sampleSchema,
    )
    expect(parsed.intent).toEqual(['investigate'])
  })
})

describe('extractJsonObjectCandidates', () => {
  it('returns unique candidates without duplicates', () => {
    const candidates = extractJsonObjectCandidates(
      '{"intent":["investigate"],"mayModifyCode":false}',
    )
    expect(candidates.length).toBeGreaterThan(0)
    expect(new Set(candidates).size).toBe(candidates.length)
  })
})
