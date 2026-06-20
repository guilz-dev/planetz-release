import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useStaleRequestGuard } from '../use-stale-request-guard.js'

describe('useStaleRequestGuard', () => {
  it('invalidates prior generation when deps change', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: number }) => useStaleRequestGuard([token]),
      { initialProps: { token: 1 } },
    )

    const firstCheck = result.current()
    rerender({ token: 2 })
    await waitFor(() => {
      expect(firstCheck()).toBe(false)
    })
    expect(result.current()()).toBe(true)
  })
})
