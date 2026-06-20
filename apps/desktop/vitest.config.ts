import { defineConfig } from 'vitest/config'
import { vitestCoverageOptions } from '../../scripts/vitest-coverage-defaults.ts'

const withCoverage = process.argv.includes('--coverage')

export default defineConfig({
  test: {
    // Instrumentation slows bundled-orbit integration tests; keep default timeout for `vitest run`.
    testTimeout: withCoverage ? 30_000 : 5_000,
    coverage: vitestCoverageOptions(
      [
        'src/main/**/*.ts',
        'src/preload/**/*.ts',
        'src/renderer/**/*.{ts,tsx}',
        'src/shared/**/*.ts',
      ],
      ['**/skins/**'],
    ),
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          globalSetup: ['src/main/__tests__/global-setup-builtin-catalog.ts'],
          include: [
            'src/main/**/__tests__/**/*.test.ts',
            'src/renderer/**/__tests__/**/*.test.ts',
            'src/shared/**/__tests__/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            'src/renderer/**/__tests__/**/*.hook.test.tsx',
            'src/renderer/**/__tests__/**/*.view.test.tsx',
          ],
        },
      },
    ],
  },
})
