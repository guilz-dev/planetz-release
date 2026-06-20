import { describe, expect, it } from 'vitest'
import {
  findDuplicatePersonaKeys,
  personaProvidersToRows,
  rowsToPersonaProviders,
} from '../persona-providers-form.js'

describe('personaProvidersToRows / rowsToPersonaProviders', () => {
  it('round-trips structured entries', () => {
    const rows = personaProvidersToRows({
      coder: { provider: 'anthropic', model: 'claude-sonnet-4' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.mode).toBe('structured')
    expect(rows[0]?.provider).toBe('anthropic')
    expect(rowsToPersonaProviders(rows)).toEqual({
      coder: { provider: 'anthropic', model: 'claude-sonnet-4' },
    })
  })

  it('drops stale effort buckets when saving after provider change', () => {
    const rows = personaProvidersToRows({
      coder: {
        provider: 'codex',
        provider_options: { codex: { reasoning_effort: 'high' }, other: { keep: 1 } },
      },
    })
    rows[0]!.provider = 'claude-sdk'
    rows[0]!.effort = 'max'
    expect(rowsToPersonaProviders(rows)).toEqual({
      coder: {
        provider: 'claude-sdk',
        provider_options: { claude: { effort: 'max' }, other: { keep: 1 } },
      },
    })
  })

  it('round-trips effort via provider_options', () => {
    const rows = personaProvidersToRows({
      coder: {
        provider: 'codex',
        model: 'gpt-5.2-codex',
        provider_options: { codex: { reasoning_effort: 'high', keep_me: true } },
      },
    })
    expect(rows[0]?.effort).toBe('high')
    expect(rows[0]?.providerOptions).toEqual({
      codex: { reasoning_effort: 'high', keep_me: true },
    })
    expect(rowsToPersonaProviders(rows)).toEqual({
      coder: {
        provider: 'codex',
        model: 'gpt-5.2-codex',
        provider_options: { codex: { reasoning_effort: 'high', keep_me: true } },
      },
    })
  })

  it('round-trips shorthand string entries', () => {
    const rows = personaProvidersToRows({ reviewer: 'openai' })
    expect(rows[0]?.mode).toBe('shorthand')
    expect(rows[0]?.shorthand).toBe('openai')
    expect(rowsToPersonaProviders(rows)).toEqual({ reviewer: 'openai' })
  })

  it('drops empty rows and returns undefined when map is empty', () => {
    expect(
      rowsToPersonaProviders([
        {
          persona: '  ',
          mode: 'structured',
          shorthand: '',
          provider: '',
          model: '',
          type: '',
          effort: '',
        },
      ]),
    ).toBeUndefined()
    expect(rowsToPersonaProviders([])).toBeUndefined()
  })
})

describe('findDuplicatePersonaKeys', () => {
  it('returns duplicate trimmed persona names', () => {
    const dupes = findDuplicatePersonaKeys([
      {
        persona: 'coder',
        mode: 'structured',
        shorthand: '',
        provider: 'a',
        model: '',
        type: '',
        effort: '',
      },
      {
        persona: ' coder ',
        mode: 'shorthand',
        shorthand: 'b',
        provider: '',
        model: '',
        type: '',
        effort: '',
      },
      {
        persona: 'reviewer',
        mode: 'structured',
        shorthand: '',
        provider: 'c',
        model: '',
        type: '',
        effort: '',
      },
    ])
    expect(dupes).toEqual(['coder'])
  })
})
