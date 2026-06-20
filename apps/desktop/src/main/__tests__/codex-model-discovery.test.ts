import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import {
  clearCodexLiveModelsCacheForTests,
  fetchCodexLiveModels,
} from '../planetz/codex-model-discovery.js'

describe('fetchCodexLiveModels', () => {
  afterEach(() => {
    clearCodexLiveModelsCacheForTests()
    vi.mocked(execa).mockReset()
  })

  it('falls back to empty models when codex CLI fails', async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not logged in',
    } as never)

    const result = await fetchCodexLiveModels()

    expect(result.models).toEqual([])
    expect(result.error).toContain('not logged in')
  })

  it('parses codex debug models JSON on success', async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        models: [{ slug: 'gpt-5.3-codex', display_name: 'GPT-5.3-Codex' }],
      }),
      stderr: '',
    } as never)

    const result = await fetchCodexLiveModels()

    expect(result.models).toEqual([{ id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }])
    expect(result.error).toBeUndefined()
  })
})
