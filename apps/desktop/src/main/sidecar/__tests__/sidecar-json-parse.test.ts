import { describe, expect, it, vi } from 'vitest'
import { parseSidecarJson } from '../sidecar-json-parse.js'

describe('parseSidecarJson', () => {
  it('parses valid JSON', () => {
    expect(parseSidecarJson<{ id: string }>('{"id":"t1"}', 'test')).toEqual({ id: 't1' })
  })

  it('logs and returns null on invalid JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseSidecarJson('not-json', 'mock task t1')).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      '[planetz][sidecar] Failed to parse mock task t1 JSON',
      expect.objectContaining({
        error: expect.any(String),
        bytes: expect.any(Number),
        preview: expect.any(String),
      }),
    )
    warn.mockRestore()
  })
})
