import { describe, expect, it } from 'vitest'
import { buildModelFilterOptions } from '../model-filter-combobox.js'

describe('buildModelFilterOptions', () => {
  it('prepends empty option and appends saved value when missing from candidates', () => {
    const options = buildModelFilterOptions({
      candidates: [{ id: 'gpt-4', source: 'live' }],
      emptyOptionLabel: '(default)',
      savedValue: 'legacy-model',
    })
    expect(options).toEqual([
      { value: '', label: '(default)' },
      { value: 'gpt-4', label: 'gpt-4' },
      { value: 'legacy-model', label: 'legacy-model (saved)' },
    ])
  })

  it('includes candidate label when present', () => {
    const options = buildModelFilterOptions({
      candidates: [{ id: 'claude-3', label: 'Sonnet', source: 'suggested' }],
    })
    expect(options).toEqual([{ value: 'claude-3', label: 'claude-3 — Sonnet' }])
  })

  it('drops redundant label suffix when display name matches model id', () => {
    const options = buildModelFilterOptions({
      candidates: [{ id: 'gpt-5.2', label: 'GPT-5.2', source: 'live' }],
    })
    expect(options).toEqual([{ value: 'gpt-5.2', label: 'gpt-5.2' }])
  })
})
