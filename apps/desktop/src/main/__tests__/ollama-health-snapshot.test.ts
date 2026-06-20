import { describe, expect, it } from 'vitest'
import { buildOllamaHealthSnapshot } from '../planetz/ollama-health-snapshot.js'

describe('buildOllamaHealthSnapshot', () => {
  it('marks healthy when tags fetch succeeds', () => {
    const snapshot = buildOllamaHealthSnapshot(
      {
        models: [{ id: 'a', label: 'a' }],
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      },
      12,
    )
    expect(snapshot.status).toBe('healthy')
    expect(snapshot.modelCount).toBe(1)
    expect(snapshot.latencyMs).toBe(12)
  })

  it('marks degraded when error but cached models remain', () => {
    const snapshot = buildOllamaHealthSnapshot(
      {
        models: [{ id: 'a', label: 'a' }],
        fetchedAt: new Date().toISOString(),
        fromCache: true,
        error: 'timeout',
        errorCode: 'timeout',
      },
      5,
    )
    expect(snapshot.status).toBe('degraded')
    expect(snapshot.liveErrorCode).toBe('timeout')
  })
})
