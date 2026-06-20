import type { EngineConfigUpdateInput } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { OrbitEngineConfigPanel } from '../orbit-engine-config-panel.js'
import { SettingsFacetsPanel } from '../settings-facets-panel.js'

function renderWithI18n(node: ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>)
}

describe('persona routing placement', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows persona routing guidance in Orbit config panel instead of row editor', async () => {
    installOrbitMock({
      getEngineConfig: vi.fn(async () => ({
        config: {},
        path: '.planetz/orbit/engine-config.yaml',
      })),
      getSettings: vi.fn(async () => ({ workspacePath: '/tmp/ws', config: null })),
    })

    renderWithI18n(<OrbitEngineConfigPanel />)

    await waitFor(() => {
      expect(screen.getByText(/Persona routing is edited in Settings → Facets/)).toBeTruthy()
    })
    expect(screen.queryByText('Add persona route')).toBeNull()
  })

  it('shows and saves runtime routing on Settings Facets persona selection', async () => {
    const getEngineConfig = vi.fn(async () => ({
      config: {
        persona_providers: {
          coder: { provider: 'openai', model: 'gpt-5' },
        },
      },
      path: '.planetz/orbit/engine-config.yaml',
    }))
    const updateEngineConfig = vi.fn(async (patch: EngineConfigUpdateInput) => ({
      config: {
        persona_providers: patch.persona_providers ?? {},
      },
      path: '.planetz/orbit/engine-config.yaml',
    }))
    installOrbitMock({
      listProjectFacets: vi.fn(async () => [
        {
          kind: 'personas' as const,
          key: 'coder',
          managedPath: '../facets/personas/coder.md',
        },
      ]),
      getEngineConfig,
      updateEngineConfig,
      listExecutionCatalog: vi.fn(async () => ({
        configuredProviders: ['openai'],
        runtimeDetectedProviders: [],
        modelsByProvider: { openai: ['gpt-5'] },
        effortsByProvider: {},
      })),
    })

    renderWithI18n(<SettingsFacetsPanel initialSelection={{ kind: 'personas', key: 'coder' }} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /personas/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /personas/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /coder/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /coder/i }))
    await waitFor(() => {
      expect(screen.getByText('Runtime routing')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Save runtime routing' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save runtime routing' }))
    await waitFor(() => {
      expect(updateEngineConfig).toHaveBeenCalledWith({
        persona_providers: {
          coder: { provider: 'openai', model: 'gpt-5' },
        },
      })
    })
  })
})
