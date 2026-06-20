import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatHandoffStartResult } from '../../lib/chat-assist-handoff'
import type { ChatAssistHandoff } from '../../store/app-store'
import { useChatAssistHandoff } from '../use-chat-assist-handoff'

function useHandoffHarness() {
  const [chatAssistHandoff, setChatAssistHandoff] = useState<ChatAssistHandoff | null>(null)
  const [chatHandoffError, setChatHandoffError] = useState<string | null>(null)
  const [workspaceValue, setWorkspaceValue] = useState('')
  const [branchOptionsCount, setBranchOptionsCount] = useState(0)
  const [providerOptionsCount, setProviderOptionsCount] = useState(0)
  const [modelOptionsCount, setModelOptionsCount] = useState(0)
  const startThreadFromHandoff = vi.fn(async (): Promise<ChatHandoffStartResult> => ({ ok: true }))

  useChatAssistHandoff({
    chatAssistHandoff,
    setChatAssistHandoff,
    setChatHandoffError,
    setChatMode: vi.fn(),
    setSelectedWorkflow: vi.fn(),
    workspaceValue,
    branchOptionsCount,
    providerOptionsCount,
    modelOptionsCount,
    startThreadFromHandoff,
    handoffNotReadyMessage: 'not ready',
    handoffFailedMessage: 'failed',
  })

  return {
    chatAssistHandoff,
    setChatAssistHandoff,
    chatHandoffError,
    workspaceValue,
    setWorkspaceValue,
    setBranchOptionsCount,
    setProviderOptionsCount,
    setModelOptionsCount,
    startThreadFromHandoff,
  }
}

describe('useChatAssistHandoff', () => {
  it('waits for form options before starting a thread', async () => {
    const { result } = renderHook(() => useHandoffHarness())

    act(() => {
      result.current.setChatAssistHandoff({
        sourceContext: 'ctx',
        workspacePath: '/repo/main',
      })
    })

    expect(result.current.startThreadFromHandoff).not.toHaveBeenCalled()

    act(() => {
      result.current.setBranchOptionsCount(1)
      result.current.setProviderOptionsCount(1)
      result.current.setModelOptionsCount(1)
    })

    await waitFor(() => {
      expect(result.current.startThreadFromHandoff).toHaveBeenCalledWith(
        expect.objectContaining({ sourceContext: 'ctx', workspacePath: '/repo/main' }),
      )
    })
  })

  it('surfaces an error when starting the handoff thread fails', async () => {
    const { result } = renderHook(() => {
      const harness = useHandoffHarness()
      harness.startThreadFromHandoff.mockResolvedValueOnce({
        ok: false,
        message: 'orbit unavailable',
      })
      return harness
    })

    act(() => {
      result.current.setChatAssistHandoff({
        sourceContext: 'ctx',
        workspacePath: '/repo/main',
      })
    })

    act(() => {
      result.current.setBranchOptionsCount(1)
      result.current.setProviderOptionsCount(1)
      result.current.setModelOptionsCount(1)
    })

    await waitFor(() => {
      expect(result.current.chatHandoffError).toBe('orbit unavailable')
    })
  })
})
