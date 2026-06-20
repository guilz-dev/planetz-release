import { BUNDLED_ORBIT_NOT_FOUND_MESSAGE, DEFAULT_CONFIG } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'

const { bundledErrorClass, runTaktCliMock } = vi.hoisted(() => {
  class BundledOrbitNotFoundError extends Error {
    readonly code = 'bundled_orbit_not_found'

    constructor(candidates: string[]) {
      super(candidates.join(','))
      this.name = 'BundledOrbitNotFoundError'
    }
  }

  return {
    bundledErrorClass: BundledOrbitNotFoundError,
    runTaktCliMock: vi.fn(),
  }
})

vi.mock('../takt/exec-cli.js', () => ({
  BundledOrbitNotFoundError: bundledErrorClass,
  BundledTaktNotFoundError: bundledErrorClass,
  outputText: (value: unknown) => String(value ?? ''),
  runTaktCli: runTaktCliMock,
}))

import { checkTaktCli } from '../takt/connection-check.js'

describe('checkTaktCli', () => {
  it('returns actionable message for missing bundled orbit', async () => {
    runTaktCliMock.mockImplementation(() => {
      throw new bundledErrorClass(['/missing/orbit'])
    })

    const result = await checkTaktCli(DEFAULT_CONFIG)

    expect(result.cli).toBe('ng')
    expect(result.lastError).toBe(BUNDLED_ORBIT_NOT_FOUND_MESSAGE)
    expect(result.checkedAt).toBeTruthy()
  })
})
