import { expect, type Page } from '@playwright/test'

/** English UI labels for smoke (matches DEFAULT_CONFIG.ui.language). */
const SMOKE_UI = {
  bridgeBroken: 'Preload bridge unavailable',
  primaryNav: 'Primary view',
  tasksPanel: 'Tasks',
  composerPanel: 'Add task',
} as const

/** Wait for dashboard chrome and assert workspace / bridge state. */
export async function runSmokeAssertions(page: Page, workspacePath: string): Promise<void> {
  await expect(page.locator('body')).toBeVisible({ timeout: 60_000 })

  await expect(page.getByText(SMOKE_UI.bridgeBroken)).toHaveCount(0)

  await page.waitForFunction(() => typeof window.orbit !== 'undefined', null, {
    timeout: 60_000,
  })

  await expect(page.getByRole('navigation', { name: SMOKE_UI.primaryNav })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole('heading', { name: SMOKE_UI.tasksPanel })).toBeVisible()
  await expect(page.getByRole('heading', { name: SMOKE_UI.composerPanel })).toBeVisible()

  const workspace = await page.evaluate(async () => window.orbit?.getWorkspace())
  expect(workspace.state).toBeTruthy()
  expect(workspace.path).toBe(workspacePath)
  expect(workspace.state?.mockQueueEnabled).toBe(true)
  expect(workspace.state?.workspace.bootstrap).toBe('takt_ready')
  expect((workspace.state?.tasks.length ?? 0) > 0).toBe(true)
}
