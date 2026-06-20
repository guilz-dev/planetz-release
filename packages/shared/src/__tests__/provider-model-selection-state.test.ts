import { describe, expect, it } from 'vitest'
import {
  normalizeLastSelectedModelByProvider,
  readLastSelectedModelForProvider,
  writeLastSelectedModelByProvider,
} from '../provider-model-selection-state.js'

describe('provider-model-selection-state', () => {
  it('normalizes persisted provider/model mappings', () => {
    expect(
      normalizeLastSelectedModelByProvider({
        ' cursor ': ' composer-2.5 ',
        ollama: '',
        codex: 1,
      }),
    ).toEqual({ cursor: 'composer-2.5' })
  })

  it('reads provider-scoped model selections', () => {
    expect(
      readLastSelectedModelForProvider(
        { lastSelectedModelByProvider: { cursor: 'composer-2.5' } },
        ' cursor ',
      ),
    ).toBe('composer-2.5')
  })

  it('writes and clears provider-scoped model selections', () => {
    const saved = writeLastSelectedModelByProvider({ cursor: 'composer-2.5' }, 'ollama', 'qwen3')
    expect(saved).toEqual({ cursor: 'composer-2.5', ollama: 'qwen3' })
    expect(writeLastSelectedModelByProvider(saved, 'cursor', '')).toEqual({ ollama: 'qwen3' })
  })
})
