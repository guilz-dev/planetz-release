import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import {
  clearCursorLiveModelsCacheForTests,
  fetchCursorLiveModels,
} from '../planetz/cursor-model-discovery.js'

describe('fetchCursorLiveModels', () => {
  afterEach(() => {
    clearCursorLiveModelsCacheForTests()
    vi.mocked(execa).mockReset()
  })

  it('falls back to empty models when cursor-agent fails', async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not logged in',
    } as never)

    const result = await fetchCursorLiveModels()

    expect(result.models).toEqual([])
    expect(result.error).toContain('not logged in')
  })

  it('parses stdout on success', async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: 'auto - Auto\ncomposer-2.5-fast - Composer 2.5 Fast',
      stderr: '',
    } as never)

    const result = await fetchCursorLiveModels()

    expect(result.models).toEqual([
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2.5-fast', label: 'Composer 2.5 Fast' },
    ])
    expect(result.error).toBeUndefined()
  })
})
