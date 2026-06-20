import { describe, expect, it } from 'vitest'
import { isChatInFlight, isChatStreamBusy, isChatStreamCancellable } from '../chat-stream-state'

describe('chat-stream-state', () => {
  it('treats streaming, retrying, and cancelling as busy', () => {
    expect(isChatStreamBusy('streaming')).toBe(true)
    expect(isChatStreamBusy('retrying')).toBe(true)
    expect(isChatStreamBusy('cancelling')).toBe(true)
    expect(isChatStreamBusy('idle')).toBe(false)
    expect(isChatStreamBusy('error')).toBe(false)
  })

  it('matches in-flight visibility with busy states', () => {
    expect(isChatInFlight('streaming')).toBe(true)
    expect(isChatInFlight('retrying')).toBe(true)
    expect(isChatInFlight('cancelling')).toBe(true)
    expect(isChatInFlight('idle')).toBe(false)
  })

  it('allows cancel only while streaming or retrying', () => {
    expect(isChatStreamCancellable('streaming')).toBe(true)
    expect(isChatStreamCancellable('retrying')).toBe(true)
    expect(isChatStreamCancellable('cancelling')).toBe(false)
    expect(isChatStreamCancellable('idle')).toBe(false)
  })
})
