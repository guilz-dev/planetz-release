import type { TaskViewModel } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useChainActions } from '../use-chain-actions.js'

function makeTask(): TaskViewModel {
  return {
    id: 'task-origin',
    title: 'Origin',
    priority: 'normal',
    status: 'completed',
    source: 'user',
    chainId: 'chain-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('useChainActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('materializeChain surfaces warnings from orbit', async () => {
    installOrbitMock({
      materializeChainEdge: vi.fn(async () => ({
        chainId: 'chain-1',
        taskId: 'task-b',
        warnings: ['branch missing', 'skipped edge'],
      })),
    })

    const { result } = renderHook(() => useChainActions())

    await act(async () => {
      await result.current.materializeChain({ chainId: 'chain-1', fromTaskId: 'task-a' })
    })

    await waitFor(() => {
      expect(result.current.chainMaterializeWarning).toBe('branch missing skipped edge')
    })
    expect(result.current.chainMaterializeBusy).toBe(false)
  })

  it('createChainTask closes dialog on success', async () => {
    const createChainTask = vi.fn(async () => ({ chainId: 'chain-1', taskId: 'task-new' }))
    installOrbitMock({ createChainTask })

    const { result } = renderHook(() => useChainActions())

    act(() => {
      result.current.requestCreateChain(makeTask())
    })
    expect(result.current.chainDialog.open).toBe(true)

    await act(async () => {
      await result.current.confirmChainCreate({
        title: 'Follow-up',
        body: 'Continue work',
        workflow: 'default',
        mode: 'branch_handoff',
      })
    })

    await waitFor(() => {
      expect(result.current.chainDialog.open).toBe(false)
    })
    expect(createChainTask).toHaveBeenCalledWith(
      expect.objectContaining({
        fromTaskId: 'task-origin',
        title: 'Follow-up',
        chainId: 'chain-1',
      }),
    )
  })
})
