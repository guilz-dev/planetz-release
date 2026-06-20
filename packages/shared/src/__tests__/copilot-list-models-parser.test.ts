import { describe, expect, it } from 'vitest'
import { filterCopilotListModels } from '../copilot-list-models-parser.js'

describe('filterCopilotListModels', () => {
  it('keeps enabled picker models with labels', () => {
    expect(
      filterCopilotListModels([
        { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex', policy: { state: 'enabled' } },
        { id: 'auto', name: 'Auto' },
      ]),
    ).toEqual([
      { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
      { id: 'auto', label: 'Auto' },
    ])
  })

  it('excludes disabled policy and picker-disabled models', () => {
    expect(
      filterCopilotListModels([
        { id: 'hidden', name: 'Hidden', policy: { state: 'disabled' } },
        { id: 'no-picker', name: 'No Picker', model_picker_enabled: false },
        { id: 'ok', name: 'OK' },
      ]),
    ).toEqual([{ id: 'ok', label: 'OK' }])
  })

  it('dedupes by id and skips invalid ids', () => {
    expect(
      filterCopilotListModels([
        { id: 'gpt-5-mini', name: 'Mini' },
        { id: 'gpt-5-mini', name: 'Dup' },
        { id: '  ', name: 'Blank' },
        { id: 'bad id', name: 'Space' },
      ]),
    ).toEqual([{ id: 'gpt-5-mini', label: 'Mini' }])
  })
})
