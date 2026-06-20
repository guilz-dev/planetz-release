import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const e2eRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: join(e2eRoot, 'tests'),
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: join(e2eRoot, 'test-results'),
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
}
