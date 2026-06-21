import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { vitestCoverageOptions } from '../../scripts/vitest-coverage-defaults.ts'

const desktopRoot = fileURLToPath(new URL('.', import.meta.url))
const electronStub = resolve(desktopRoot, 'src/main/__tests__/stubs/electron.ts')
const withCoverage = process.argv.includes('--coverage')

export default defineConfig({
  resolve: {
    alias: {
      electron: electronStub,
    },
  },
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
