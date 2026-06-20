import { test } from '@playwright/test'
import { launchPlanetzApp } from '../helpers/launch.ts'
import { runSmokeAssertions } from '../helpers/smoke-assertions.ts'

test.describe('electron smoke', () => {
  test('starts, loads fixture workspace, and exposes orbit bridge', async () => {
    const { app, window, workspacePath, cleanup } = await launchPlanetzApp()

    try {
      await runSmokeAssertions(window, workspacePath)
    } finally {
      await app.close()
      cleanup()
    }
  })
})
