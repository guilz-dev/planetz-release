import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_INTEGRATIONS_STATE, installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useIntegrationActions } from '../use-integration-actions.js'
import { useToastStore } from '../use-toast.js'

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars?.detail ? `${key}:${vars.detail}` : key,
  }),
}))

describe('useIntegrationActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useToastStore.setState({ toasts: [] })
  })

  it('stores bearer secret when hook server enables', async () => {
    installOrbitMock({
      toggleHookServer: vi.fn(async () => ({
        state: {
          ...DEFAULT_INTEGRATIONS_STATE,
          hookServer: { ...DEFAULT_INTEGRATIONS_STATE.hookServer, enabled: true, hasSecret: true },
        },
        bearerSecret: 'secret-token',
      })),
    })

    const { result } = renderHook(() => useIntegrationActions())

    await act(async () => {
      await result.current.toggleHookServer({ enabled: true, port: 17_840 })
    })

    expect(result.current.hookBearerSecret).toBe('secret-token')
  })

  it('clears bearer secret when hook server disables', async () => {
    installOrbitMock({
      toggleHookServer: vi.fn(async () => ({
        state: DEFAULT_INTEGRATIONS_STATE,
      })),
    })

    const { result } = renderHook(() => useIntegrationActions())

    act(() => {
      result.current.setHookBearerSecret('was-set')
    })
    expect(result.current.hookBearerSecret).toBe('was-set')

    await act(async () => {
      await result.current.toggleHookServer({ enabled: false })
    })

    expect(result.current.hookBearerSecret).toBeNull()
  })

  it('shows toast when hook server start fails', async () => {
    installOrbitMock({
      toggleHookServer: vi.fn(async () => {
        throw new Error('Hook server port 17840 is already in use')
      }),
    })

    const { result } = renderHook(() => useIntegrationActions())

    await expect(
      act(async () => {
        await result.current.toggleHookServer({ enabled: true, port: 17_840 })
      }),
    ).rejects.toThrow('already in use')

    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]?.kind).toBe('error')
  })
})
