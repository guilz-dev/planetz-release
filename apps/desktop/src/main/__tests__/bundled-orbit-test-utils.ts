import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { candidateBundledOrbitRoots } from '../takt/exec-cli.js'

export const BUNDLED_ORBIT_CLI_RELATIVE = join('dist', 'app', 'cli', 'index.js')

/** Resolves bundled orbit CLI path and root when doctor fixtures are present. */
export function resolveBundledOrbitCliFixture(): { cli: string; root: string } {
  for (const root of candidateBundledOrbitRoots()) {
    const cli = join(root, BUNDLED_ORBIT_CLI_RELATIVE)
    const plannerFacet = join(root, 'builtins', 'en', 'facets', 'personas', 'planner.md')
    if (existsSync(cli) && existsSync(plannerFacet)) {
      return { cli, root }
    }
  }
  throw new Error('bundled orbit CLI fixture not found')
}

/** True when dev/packaged bundled orbit CLI and builtin facet fixtures are present. */
export function bundledOrbitDoctorAvailable(): boolean {
  try {
    resolveBundledOrbitCliFixture()
    return true
  } catch {
    return false
  }
}

export function assertNoBlockingDoctorMessages(
  diagnostics: Array<{ level: string; message: string }>,
): void {
  const errors = diagnostics.filter((d) => d.level === 'error')
  const combined = errors.map((d) => d.message).join('\n')
  expect(combined).not.toMatch(/workflow not found/i)
  expect(combined).not.toMatch(/Persona prompt file path is not allowed/i)
  expect(combined).not.toMatch(/failed to load/i)
  expect(combined).not.toMatch(/references missing resource/i)
  expect(errors).toEqual([])
}
