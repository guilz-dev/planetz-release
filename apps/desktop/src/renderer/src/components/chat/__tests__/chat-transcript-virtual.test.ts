import { CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { shouldVirtualizeChatTranscript } from '../chat-transcript-virtual'

describe('shouldVirtualizeChatTranscript', () => {
  it('enables virtualization at the configured turn threshold', () => {
    expect(shouldVirtualizeChatTranscript(CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS - 1)).toBe(false)
    expect(shouldVirtualizeChatTranscript(CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS)).toBe(true)
    expect(shouldVirtualizeChatTranscript(500)).toBe(true)
  })
})
