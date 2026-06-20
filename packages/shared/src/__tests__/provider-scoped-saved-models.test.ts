import { describe, expect, it } from 'vitest'
import { collectProviderScopedSavedModelIds } from '../provider-scoped-saved-models.js'

describe('collectProviderScopedSavedModelIds', () => {
  it('includes current model and provider-matched engine/workflow defaults only', () => {
    expect(
      collectProviderScopedSavedModelIds({
        provider: 'ollama',
        currentModel: 'llama3.2:latest',
        lastSelectedModel: 'qwen2.5:14b',
        engineConfig: { provider: 'cursor', model: 'composer-2.5' },
        workflowDefaults: { provider: 'ollama', model: 'qwen2.5:7b' },
      }),
    ).toEqual(['llama3.2:latest', 'qwen2.5:14b', 'qwen2.5:7b'])
  })

  it('omits workflow model when workflow provider does not match', () => {
    expect(
      collectProviderScopedSavedModelIds({
        provider: 'ollama',
        engineConfig: { provider: 'ollama', model: 'llama3.1:8b' },
        workflowDefaults: { model: 'composer-2.5' },
      }),
    ).toEqual(['llama3.1:8b'])
  })
})
