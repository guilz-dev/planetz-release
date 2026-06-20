/**
 * Electron smoke runner (used by `pnpm test:e2e`).
 * Playwright Test discovery can hang in some sandboxed shells; this script uses the same helpers.
 * Failure artifacts: trace zip + screenshot (see e2e/README.md).
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchPlanetzApp } from './helpers/launch.ts'
import { runSmokeAssertions } from './helpers/smoke-assertions.ts'

const e2eRoot = dirname(fileURLToPath(import.meta.url))
const artifactDir = join(e2eRoot, 'test-results')

const { app, window, workspacePath, cleanup } = await launchPlanetzApp()
const context = window.context()
let tracing = false

try {
  await context.tracing.start({ screenshots: true, snapshots: true })
  tracing = true

  await runSmokeAssertions(window, workspacePath)
  console.info('[desktop-e2e] smoke passed')
} catch (error) {
  mkdirSync(artifactDir, { recursive: true })
  if (tracing) {
    await context.tracing
      .stop({ path: join(artifactDir, 'smoke-trace.zip') })
      .catch(() => undefined)
    tracing = false
  }
  await window.screenshot({ path: join(artifactDir, 'smoke-failure.png') }).catch(() => undefined)
  throw error
} finally {
  if (tracing) {
    await context.tracing.stop().catch(() => undefined)
  }
  await app.close()
  cleanup()
}
