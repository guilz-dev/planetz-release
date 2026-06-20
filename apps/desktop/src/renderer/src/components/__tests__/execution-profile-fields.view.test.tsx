import type { ExecutionCatalog } from '@planetz/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { ExecutionProfileFields, type ExecutionProfileValue } from '../execution-profile-fields.js'

const catalog: ExecutionCatalog = {
  configuredProviders: ['cursor', 'ollama'],
  runtimeDetectedProviders: [],
  modelsByProvider: {
    cursor: ['composer-2.5'],
    ollama: ['llama3.1:8b'],
  },
  effortsByProvider: {},
}

function ControlledFields({ initialValue }: { initialValue: ExecutionProfileValue }) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <ExecutionProfileFields
        providerId="provider"
        modelId="model"
        value={value}
        sources={{
          engineConfig: {
            provider: initialValue.provider,
            model: initialValue.model,
          },
          catalog,
          currentProvider: value.provider,
          currentModel: value.model,
        }}
        onChange={setValue}
      />
      <output data-testid="current-model">{value.model}</output>
    </>
  )
}

describe('ExecutionProfileFields', () => {
  beforeEach(() => {
    installOrbitMock()
  })

  it('restores the remembered model for the next provider after a switch', async () => {
    window.orbit.listProviderModels = vi.fn(async (input: { provider: string }) => {
      if (input.provider === 'ollama') {
        return {
          models: [{ id: 'llama3.1:8b', source: 'saved' as const }],
          lastSelectedModel: 'llama3.1:8b',
        }
      }
      return {
        models: [{ id: 'composer-2.5', source: 'saved' as const }],
        lastSelectedModel: 'composer-2.5',
      }
    })

    render(
      <I18nProvider>
        <ControlledFields initialValue={{ provider: 'cursor', model: 'composer-2.5' }} />
      </I18nProvider>,
    )

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ollama' } })

    await waitFor(() => {
      expect(screen.getByTestId('current-model').textContent).toBe('llama3.1:8b')
    })
  })

  it('persists the selected model for the current provider', async () => {
    const rememberProviderModelSelection = vi.fn(async () => ({ ok: true as const }))
    window.orbit.rememberProviderModelSelection = rememberProviderModelSelection
    window.orbit.listProviderModels = vi.fn(async () => ({
      models: [{ id: 'composer-2.5', source: 'history' as const }],
    }))

    render(
      <I18nProvider>
        <ControlledFields initialValue={{ provider: 'cursor', model: '' }} />
      </I18nProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'composer-2.5' }))

    await waitFor(() => {
      expect(rememberProviderModelSelection).toHaveBeenCalledWith({
        provider: 'cursor',
        model: 'composer-2.5',
      })
    })
  })
})
