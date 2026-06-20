import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useProviderModelSetupWizard } from '../use-provider-model-setup-wizard.js'

describe('useProviderModelSetupWizard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows wizard when engine defaults are missing and import offer is absent', async () => {
    installOrbitMock({
      getEngineConfig: vi.fn(async () => ({ config: {}, path: '/tmp/engine.yaml' })),
    })

    const { result } = renderHook(() => useProviderModelSetupWizard(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.showWizard).toBe(true)
  })

  it('defers wizard while canonical import offer is present', async () => {
    installOrbitMock({
      getEngineConfig: vi.fn(async () => ({ config: {}, path: '/tmp/engine.yaml' })),
    })

    const { result } = renderHook(() =>
      useProviderModelSetupWizard({ engineConfig: true, workflows: [] }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.showWizard).toBe(false)
  })

  it('does not open wizard when engine config load fails', async () => {
    installOrbitMock({
      getEngineConfig: vi.fn(async () => {
        throw new Error('permission denied')
      }),
    })

    const { result } = renderHook(() => useProviderModelSetupWizard(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.showWizard).toBe(false)
    expect(result.current.loadError).toContain('permission denied')
  })

  it('skips wizard when provider and model are configured', async () => {
    installOrbitMock({
      getEngineConfig: vi.fn(async () => ({
        config: { provider: 'cursor', model: 'composer-1' },
        path: '/tmp/engine.yaml',
      })),
    })

    const { result } = renderHook(() => useProviderModelSetupWizard(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.showWizard).toBe(false)
  })
})
