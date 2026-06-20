import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect, type Page } from '@playwright/test'
import { INTRO_SCENE_MANIFEST_PATH, INTRO_SCENES_DIR } from '../helpers/paths.ts'
import {
  type IntroSegmentCapturePlan,
  type IntroSessionCaptureMode,
  planSegmentCapture,
} from './intro-capture-mode.ts'
import type { IntroScript, IntroScriptSegment } from './intro-script.ts'

/** Post-navigation settle before screenshots. */
export const INTRO_SCENE_SETTLE_MS = 400

/** Default hold after scene actions when recording video timing. */
export const INTRO_DEFAULT_RECORD_HOLD_MS = 3000

export interface IntroSceneContext {
  page: Page
  segment?: IntroScriptSegment
}

export type IntroSceneAction = (ctx: IntroSceneContext) => Promise<void>

export interface IntroSceneCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface IntroSceneManifestEntry {
  scene: string
  startMs: number
  endMs: number
  crop: IntroSceneCropRect | null
  sourceScene: string
}

export interface IntroSceneManifest {
  sessionVideo: string
  output: IntroScript['output']
  scenes: IntroSceneManifestEntry[]
}

export interface IntroWalkthroughOptions {
  sessionMode: IntroSessionCaptureMode
  recorder?: IntroSessionRecorder
}

export class IntroSessionRecorder {
  private originMs = 0
  private readonly entries: IntroSceneManifestEntry[] = []

  start(): void {
    this.originMs = Date.now()
  }

  nowMs(): number {
    return Math.max(0, Date.now() - this.originMs)
  }

  push(entry: IntroSceneManifestEntry): void {
    this.entries.push(entry)
  }

  /** Include navigation / settle time before the next scene in the previous clip. */
  extendLastEntryEnd(nowMs: number): void {
    const last = this.entries.at(-1)
    if (last !== undefined && nowMs > last.endMs) {
      last.endMs = nowMs
    }
  }

  getEntries(): IntroSceneManifestEntry[] {
    return [...this.entries]
  }
}

const RUNNING_TASK_PATTERN = /Implement auth core/i

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(INTRO_SCENE_SETTLE_MS)
}

async function ensureTaskView(page: Page): Promise<void> {
  const onDashboard = await page
    .getByRole('heading', { name: /^Tasks$/i })
    .isVisible()
    .catch(() => false)
  if (!onDashboard) {
    await page.evaluate(() => {
      window.location.hash = ''
    })
    await expect(page.getByRole('navigation', { name: /Primary view/i })).toBeVisible({
      timeout: 60_000,
    })
  }
  const taskRail = page.getByRole('navigation', { name: /Primary view/i }).getByRole('button', {
    name: /^Task$/i,
  })
  if (await taskRail.isVisible().catch(() => false)) {
    const isCurrent = await taskRail.getAttribute('aria-current')
    if (isCurrent !== 'page') {
      await taskRail.click()
    }
    await settle(page)
  }
}

async function selectRunningAuthTask(page: Page): Promise<void> {
  const taskCard = page.getByRole('button', { name: RUNNING_TASK_PATTERN })
  await expect(taskCard).toBeVisible({ timeout: 60_000 })
  await taskCard.click()
  await settle(page)
}

async function openSettingsProviders(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^Settings$/i })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /^Settings$/i })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('tab', { name: /^Providers$/i }).click()
  await expect(page.getByText(/Allowed providers/i)).toBeVisible({ timeout: 30_000 })
  await settle(page)
}

async function openSpecStudioTracePhase(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: /Primary view/i })
    .getByRole('button', { name: /^Spec Studio$/i })
    .click()
  await expect(page.getByRole('heading', { name: /^Spec Studio$/i })).toBeVisible({
    timeout: 60_000,
  })

  const threadList = page
    .locator('aside')
    .filter({ has: page.getByPlaceholder(/^Search$/i) })
    .locator('ul button')
  const threadCount = await threadList.count()
  if (threadCount === 0) {
    throw new Error('no spec threads in workspace')
  }
  await threadList.first().click()
  await settle(page)

  const traceTab = page.getByRole('tab', { name: /Check implementation drift/i })
  await expect(traceTab).toBeVisible({ timeout: 15_000 })
  await traceTab.click()
  await expect(page.getByRole('complementary', { name: /Intent rail/i })).toBeVisible({
    timeout: 15_000,
  })
  await settle(page)
}

export const INTRO_SCENE_ACTIONS: Record<string, IntroSceneAction> = {
  dashboard_overview: async ({ page }) => {
    await ensureTaskView(page)
    await expect(page.getByRole('heading', { name: /^Tasks$/i })).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByRole('button', { name: RUNNING_TASK_PATTERN })).toBeVisible()
    await settle(page)
  },

  running_task: async ({ page }) => {
    await ensureTaskView(page)
    await selectRunningAuthTask(page)
    await expect(page.getByRole('heading', { name: /^Tasks$/i })).toBeVisible()
    await settle(page)
  },

  parallel_tasks: async ({ page }) => {
    await ensureTaskView(page)
    await expect(page.getByRole('button', { name: RUNNING_TASK_PATTERN })).toBeVisible()
    await expect(page.getByRole('button', { name: /Fix flaky test/i })).toBeVisible({
      timeout: 30_000,
    })
    await settle(page)
  },

  workflow_steps: async ({ page }) => {
    await ensureTaskView(page)
    await selectRunningAuthTask(page)
    const region = page.getByRole('region', { name: /Workflow progress/i })
    await expect(region).toBeVisible({ timeout: 15_000 })
    await settle(page)
  },

  intent_rail: async ({ page }) => {
    await openSpecStudioTracePhase(page)
  },

  mock_intent_rail: async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#mock/intent-rail'
    })
    await expect(page.getByRole('complementary', { name: /Intent rail/i })).toBeVisible({
      timeout: 30_000,
    })
    await settle(page)
  },

  mock_intro_intent_rail: async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#mock/intro-intent-rail'
    })
    await expect(page.getByRole('heading', { name: /Intent ledger/i })).toBeVisible({
      timeout: 30_000,
    })
    await settle(page)
  },

  mock_workflow_steps_crop: async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#mock/running-task'
    })
    await expect(
      page.getByRole('heading', { name: /Running task — production components/i }),
    ).toBeVisible({ timeout: 30_000 })
    const region = page.getByRole('region', { name: /workflow progress/i })
    await expect(region.first()).toBeVisible({ timeout: 15_000 })
    await settle(page)
  },

  mock_intro_harness: async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#mock/intro-harness'
    })
    await expect(page.getByRole('heading', { name: /Approval harness/i })).toBeVisible({
      timeout: 30_000,
    })
    await settle(page)
  },

  settings_edge: async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = ''
    })
    await settle(page)
    await openSettingsProviders(page)
  },
}

function sceneOutputPath(sceneId: string): string {
  return join(INTRO_SCENES_DIR, `${sceneId}.png`)
}

function recordHoldMs(segment: IntroScriptSegment): number {
  return segment.recordHoldMs ?? INTRO_DEFAULT_RECORD_HOLD_MS
}

async function captureSceneScreenshot(page: Page, sceneId: string, outPath: string): Promise<void> {
  mkdirSync(dirname(outPath), { recursive: true })
  if (sceneId === 'mock_workflow_steps_crop') {
    const region = page.getByRole('region', { name: /workflow progress/i }).first()
    await region.screenshot({ path: outPath })
    return
  }
  if (sceneId === 'intent_rail' || sceneId === 'mock_intent_rail') {
    const rail = page.getByRole('complementary', { name: /Intent rail/i })
    await rail.screenshot({ path: outPath })
    return
  }
  await page.screenshot({ path: outPath })
}

async function runSceneAction(
  page: Page,
  sceneId: string,
  segment?: IntroScriptSegment,
): Promise<void> {
  const action = INTRO_SCENE_ACTIONS[sceneId]
  if (!action) {
    throw new Error(`[intro] unknown scene: ${sceneId}`)
  }
  await action({ page, segment })
}

interface SceneRunResult {
  sourceScene: string
}

async function runSegmentScene(page: Page, segment: IntroScriptSegment): Promise<SceneRunResult> {
  try {
    await runSceneAction(page, segment.scene, segment)
    return { sourceScene: segment.scene }
  } catch (error) {
    if (!segment.fallbackScene) throw error
    console.warn(
      `[intro] ${segment.scene} failed (${error instanceof Error ? error.message : String(error)}); fallback ${segment.fallbackScene}`,
    )
    await runSceneAction(page, segment.fallbackScene)
    return { sourceScene: segment.fallbackScene }
  }
}

async function captureSegmentScene(
  page: Page,
  segment: IntroScriptSegment,
  plan: IntroSegmentCapturePlan,
  recorder?: IntroSessionRecorder,
): Promise<void> {
  const startMs = recorder?.nowMs() ?? 0

  const { sourceScene } = await runSegmentScene(page, segment)

  if (plan.screenshot) {
    const outPath = sceneOutputPath(segment.scene)
    await captureSceneScreenshot(page, sourceScene, outPath)
    console.info(`[intro] captured ${sourceScene} -> ${outPath}`)
  }

  if (plan.video && recorder) {
    const holdMs = recordHoldMs(segment)
    await page.waitForTimeout(holdMs)
    const endMs = recorder.nowMs()
    recorder.push({
      scene: segment.scene,
      startMs,
      endMs,
      crop: null,
      sourceScene,
    })
    console.info(
      `[intro] recorded video timing ${segment.scene} (${startMs}ms–${endMs}ms, source=${sourceScene})`,
    )
  } else if (!plan.screenshot) {
    console.info(`[intro] skip capture (${segment.capture}): ${segment.scene}`)
  }
}

export async function runIntroWalkthrough(
  page: Page,
  script: IntroScript,
  options: IntroWalkthroughOptions,
): Promise<void> {
  mkdirSync(INTRO_SCENES_DIR, { recursive: true })

  for (const segment of script.segments) {
    const plan = planSegmentCapture(segment, options.sessionMode)
    if (!plan.screenshot && !plan.video) {
      console.info(`[intro] skip segment (${segment.capture}): ${segment.scene}`)
      continue
    }
    if (plan.video && options.recorder) {
      options.recorder.extendLastEntryEnd(options.recorder.nowMs())
    }
    await captureSegmentScene(page, segment, plan, options.recorder)
  }
}

export function writeIntroSceneManifest(manifest: IntroSceneManifest): void {
  mkdirSync(dirname(INTRO_SCENE_MANIFEST_PATH), { recursive: true })
  writeFileSync(INTRO_SCENE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}
