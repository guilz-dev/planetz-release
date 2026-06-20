/**
 * Capture intro demo screenshots and/or session video for marketing (see docs/marketing/planetz-intro-video-runbook.md).
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launchPlanetzApp } from '../helpers/launch.ts'
import { INTRO_ARTIFACTS_DIR, INTRO_RAW_DIR, INTRO_SESSION_VIDEO_PATH } from '../helpers/paths.ts'
import { runSmokeAssertions } from '../helpers/smoke-assertions.ts'
import {
  assertVideoCaptureConfigured,
  assertVideoCaptureRecorded,
  resolveIntroSessionCaptureMode,
} from './intro-capture-mode.ts'
import {
  IntroSessionRecorder,
  runIntroWalkthrough,
  writeIntroSceneManifest,
} from './intro-scenes.ts'
import { loadIntroScript } from './intro-script.ts'

const artifactDir = INTRO_ARTIFACTS_DIR
mkdirSync(artifactDir, { recursive: true })

const script = loadIntroScript()
const sessionMode = resolveIntroSessionCaptureMode()
assertVideoCaptureConfigured(script.segments, sessionMode)
const recordsVideo = sessionMode === 'video' || sessionMode === 'both'
const { width, height } = script.output

const recorder = recordsVideo ? new IntroSessionRecorder() : undefined

const { app, window, workspacePath, cleanup } = await launchPlanetzApp({
  ...(recordsVideo
    ? {
        recordVideo: {
          dir: INTRO_RAW_DIR,
          size: { width, height },
        },
      }
    : {}),
  viewport: { width, height },
})

recorder?.start()

const context = window.context()
const pageVideo = recordsVideo ? window.video() : null
let tracing = false
let manifestWritten = false

try {
  await context.tracing.start({ screenshots: true, snapshots: true })
  tracing = true

  await runSmokeAssertions(window, workspacePath)
  await runIntroWalkthrough(window, script, { sessionMode, recorder })
  console.info('[intro] walkthrough complete')

  if (recordsVideo && recorder) {
    const entries = recorder.getEntries()
    assertVideoCaptureRecorded(entries.length)
    writeIntroSceneManifest({
      sessionVideo: 'raw/session.webm',
      output: script.output,
      scenes: entries,
    })
    manifestWritten = true
  }
} catch (error) {
  mkdirSync(join(artifactDir, 'scenes'), { recursive: true })
  if (tracing) {
    await context.tracing
      .stop({ path: join(artifactDir, 'intro-trace.zip') })
      .catch(() => undefined)
    tracing = false
  }
  await window.screenshot({ path: join(artifactDir, 'failure.png') }).catch(() => undefined)
  throw error
} finally {
  if (tracing) {
    await context.tracing.stop().catch(() => undefined)
  }
  await app.close()
  if (recordsVideo && pageVideo && manifestWritten) {
    mkdirSync(INTRO_RAW_DIR, { recursive: true })
    await pageVideo.saveAs(INTRO_SESSION_VIDEO_PATH)
    console.info(`[intro] wrote session video -> ${INTRO_SESSION_VIDEO_PATH}`)
  }
  cleanup()
}
