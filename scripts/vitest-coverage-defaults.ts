import type { CoverageOptions } from 'vitest'

const COMMON_COVERAGE_EXCLUDE = [
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.d.ts',
  '**/out/**',
] as const

/** Shared Vitest v8 coverage defaults for Planetz packages. */
export function vitestCoverageOptions(
  include: string[],
  extraExclude: string[] = [],
): CoverageOptions {
  return {
    provider: 'v8',
    reporter: ['text', 'text-summary', 'html', 'json-summary'],
    reportsDirectory: './coverage',
    include,
    exclude: [...COMMON_COVERAGE_EXCLUDE, ...extraExclude],
  }
}
