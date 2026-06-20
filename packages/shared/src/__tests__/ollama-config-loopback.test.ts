import { describe, expect, it } from 'vitest'
import { isOllamaLoopbackOrigin } from '../ollama-config.js'

describe('isOllamaLoopbackOrigin', () => {
  it('accepts localhost and loopback hosts', () => {
    expect(isOllamaLoopbackOrigin('http://127.0.0.1:11434')).toBe(true)
    expect(isOllamaLoopbackOrigin('http://localhost:11434')).toBe(true)
    expect(isOllamaLoopbackOrigin('http://[::1]:11434')).toBe(true)
  })

  it('rejects remote hosts', () => {
    expect(isOllamaLoopbackOrigin('http://192.168.1.10:11434')).toBe(false)
    expect(isOllamaLoopbackOrigin('https://ollama.example.com')).toBe(false)
  })
})
