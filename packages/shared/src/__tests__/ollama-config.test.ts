import { describe, expect, it } from 'vitest'
import {
  isOllamaEngineConfigured,
  mergeEngineConfigPreview,
  normalizeOllamaHostForEnv,
  normalizeOllamaOriginForFetch,
  OLLAMA_DEFAULT_BASE_URL,
  readOllamaBaseUrl,
  resolveOllamaFetchOrigin,
  writeOllamaBaseUrl,
} from '../ollama-config.js'

describe('ollama-config', () => {
  it('normalizes fetch origin with default', () => {
    expect(normalizeOllamaOriginForFetch()).toBe(OLLAMA_DEFAULT_BASE_URL)
    expect(normalizeOllamaOriginForFetch('127.0.0.1:11435')).toBe('http://127.0.0.1:11435')
    expect(normalizeOllamaOriginForFetch('http://localhost:11434/')).toBe('http://localhost:11434')
  })

  it('normalizes OLLAMA_HOST for env', () => {
    expect(normalizeOllamaHostForEnv('http://127.0.0.1:11434')).toBe('127.0.0.1:11434')
    expect(normalizeOllamaHostForEnv('http://docker.local')).toBe('docker.local:11434')
  })

  it('merges engine preview over effective config', () => {
    const effective = writeOllamaBaseUrl({ provider: 'ollama' }, 'http://127.0.0.1:11434')
    const preview = writeOllamaBaseUrl({ provider: 'ollama' }, 'http://10.0.0.2:11434')
    expect(readOllamaBaseUrl(mergeEngineConfigPreview(effective, preview))).toBe(
      'http://10.0.0.2:11434',
    )
  })

  it('detects ollama engine configuration', () => {
    expect(isOllamaEngineConfigured({ provider: 'ollama' })).toBe(true)
    expect(isOllamaEngineConfigured({ provider: 'cursor' })).toBe(false)
    expect(
      isOllamaEngineConfigured(
        writeOllamaBaseUrl({ provider: 'cursor' }, 'http://127.0.0.1:11434'),
      ),
    ).toBe(true)
  })

  it('resolves fetch origin from engine config', () => {
    expect(resolveOllamaFetchOrigin(writeOllamaBaseUrl({}, 'http://10.0.0.2:11434'))).toBe(
      'http://10.0.0.2:11434',
    )
  })

  it('round-trips base_url on engine config', () => {
    const withUrl = writeOllamaBaseUrl({}, 'http://10.0.0.2:11434')
    expect(readOllamaBaseUrl(withUrl)).toBe('http://10.0.0.2:11434')
    const cleared = writeOllamaBaseUrl(withUrl, undefined)
    expect(readOllamaBaseUrl(cleared)).toBeUndefined()
  })
})
