import { defineConfig } from 'vitest/config'
import { vitestCoverageOptions } from '../../scripts/vitest-coverage-defaults.ts'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: vitestCoverageOptions(['src/**/*.ts']),
  },
})
