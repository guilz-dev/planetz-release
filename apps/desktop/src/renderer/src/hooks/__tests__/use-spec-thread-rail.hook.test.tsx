import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge } from '../../__tests__/orbit-mock.js'
import { useSpecThreadRail } from '../use-spec-thread-rail.js'

describe('useSpecThreadRail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps current draft when generateIntentDraft returns null', async () => {
    const generateIntentDraft = vi.fn(async () => ({ draft: null }))
    const orbit = createDefaultOrbitBridge({
      getCurrentDecidedIntent: vi.fn(async () => ({
        intent: {
          id: 'thread-1#v1',
          threadId: 'thread-1',
          version: 1,
          what: 'Saved intent',
          why: 'Saved reason',
          outOfScope: [],
          reason: null,
          createdAt: '2026-06-16T00:00:00.000Z',
        },
      })),
      getIntentDraft: vi.fn(async () => ({
        draft: {
          threadId: 'thread-1',
          autoGenerate: true,
          what: 'Draft what',
          why: 'Draft why',
          outOfScopeText: '',
          touchedByUser: false,
          basedOnIntentVersion: 1,
        },
      })),
      generateIntentDraft,
    })
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { orbit }))

    const { result } = renderHook(() => useSpecThreadRail('thread-1'))
    await waitFor(() => {
      expect(result.current.intentDraft?.what).toBe('Draft what')
    })

    await act(async () => {
      await result.current.generateIntentDraft({ sourceTurnId: 'turn-2' })
    })

    expect(generateIntentDraft).toHaveBeenCalledWith({
      threadId: 'thread-1',
      sourceTurnId: 'turn-2',
    })
    expect(result.current.intentDraft).toMatchObject({
      threadId: 'thread-1',
      autoGenerate: true,
      what: 'Draft what',
      why: 'Draft why',
    })
  })
})
