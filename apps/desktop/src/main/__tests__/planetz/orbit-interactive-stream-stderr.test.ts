import { describe, expect, it, vi } from 'vitest'
import { feedOrbitInteractiveStreamStderr } from '../../planetz/orbit-interactive-client.js'

describe('feedOrbitInteractiveStreamStderr', () => {
  it('parses complete NDJSON lines from stderr chunks', () => {
    const buffer = { remainder: '' }
    const lines: Array<{ sessionId: string; seq: number }> = []
    feedOrbitInteractiveStreamStderr(
      '{"v":1,"sessionId":"s1","seq":1,"event":{"type":"text","data":{"text":"a"}}}\n{"v":1,',
      buffer,
      (line) => lines.push({ sessionId: line.sessionId, seq: line.seq }),
    )
    expect(lines).toEqual([{ sessionId: 's1', seq: 1 }])
    expect(buffer.remainder).toBe('{"v":1,')
    feedOrbitInteractiveStreamStderr('"sessionId":"s1","seq":2,"done":true}\n', buffer, (line) =>
      lines.push({ sessionId: line.sessionId, seq: line.seq }),
    )
    expect(lines).toEqual([
      { sessionId: 's1', seq: 1 },
      { sessionId: 's1', seq: 2 },
    ])
    expect(buffer.remainder).toBe('')
  })

  it('ignores non-JSON stderr noise', () => {
    const buffer = { remainder: '' }
    const onLine = vi.fn()
    feedOrbitInteractiveStreamStderr('debug: noisy\n', buffer, onLine)
    expect(onLine).not.toHaveBeenCalled()
  })
})
