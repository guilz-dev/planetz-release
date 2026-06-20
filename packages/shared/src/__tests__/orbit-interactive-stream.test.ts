import { describe, expect, it } from 'vitest'
import {
  createComposerStreamAbortedLine,
  parseOrbitInteractiveStreamLine,
} from '../orbit-interactive-stream.js'

describe('orbit-interactive-stream', () => {
  it('parses valid NDJSON stream lines', () => {
    const line = parseOrbitInteractiveStreamLine(
      JSON.stringify({
        v: 1,
        sessionId: 'composer_1',
        seq: 2,
        event: { type: 'text', data: { text: 'hi' } },
      }),
    )
    expect(line).toMatchObject({
      sessionId: 'composer_1',
      seq: 2,
      event: { type: 'text', data: { text: 'hi' } },
    })
  })

  it('rejects invalid lines', () => {
    expect(parseOrbitInteractiveStreamLine('not json')).toBeNull()
    expect(
      parseOrbitInteractiveStreamLine(JSON.stringify({ v: 2, sessionId: 'x', seq: 1 })),
    ).toBeNull()
  })

  it('createComposerStreamAbortedLine marks done+aborted', () => {
    const line = createComposerStreamAbortedLine('composer_abort')
    expect(line).toMatchObject({ sessionId: 'composer_abort', done: true, aborted: true })
  })
})
