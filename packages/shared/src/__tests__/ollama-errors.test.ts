import { describe, expect, it } from 'vitest'
import { classifyOllamaError } from '../ollama-errors.js'

describe('classifyOllamaError', () => {
  it('maps connection refused messages', () => {
    expect(classifyOllamaError({ message: 'fetch failed ECONNREFUSED' }).code).toBe(
      'connection_refused',
    )
  })

  it('maps HTTP status errors', () => {
    expect(classifyOllamaError({ message: 'bad gateway', status: 502 }).code).toBe('http_error')
  })

  it('maps timeout messages', () => {
    expect(classifyOllamaError({ message: 'The operation was aborted due to timeout' }).code).toBe(
      'timeout',
    )
  })
})
