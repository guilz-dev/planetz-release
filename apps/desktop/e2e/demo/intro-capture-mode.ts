import type { IntroScriptSegment } from './intro-script.ts'

export type IntroSessionCaptureMode = 'screenshot' | 'video' | 'both'

const VALID_MODES = new Set<IntroSessionCaptureMode>(['screenshot', 'video', 'both'])

export function resolveIntroSessionCaptureMode(): IntroSessionCaptureMode {
  const raw = process.env.PLANETZ_INTRO_CAPTURE?.trim().toLowerCase()
  if (!raw || raw === 'screenshot') return 'screenshot'
  if (VALID_MODES.has(raw as IntroSessionCaptureMode)) {
    return raw as IntroSessionCaptureMode
  }
  throw new Error(`[intro] invalid PLANETZ_INTRO_CAPTURE: ${raw} (use screenshot|video|both)`)
}

export function introVideoAllSegments(): boolean {
  return process.env.PLANETZ_INTRO_VIDEO_ALL === '1'
}

export interface IntroSegmentCapturePlan {
  screenshot: boolean
  video: boolean
}

export function planSegmentCapture(
  segment: IntroScriptSegment,
  sessionMode: IntroSessionCaptureMode,
): IntroSegmentCapturePlan {
  if (segment.capture === 'generated') {
    return { screenshot: false, video: false }
  }

  const wantsScreenshot = sessionMode === 'screenshot' || sessionMode === 'both'
  const wantsVideo = sessionMode === 'video' || sessionMode === 'both'

  if (segment.capture === 'video') {
    return {
      screenshot: sessionMode === 'both',
      video: wantsVideo,
    }
  }

  if (wantsVideo && introVideoAllSegments()) {
    return { screenshot: wantsScreenshot, video: true }
  }

  return {
    screenshot: wantsScreenshot,
    video: false,
  }
}

const VIDEO_CAPTURE_EMPTY_HINT =
  'Set PLANETZ_INTRO_VIDEO_ALL=1, run make record-intro-demo-video, or mark segments with capture: "video" in planetz-intro-en.script.json'

export function countPlannedVideoSegments(
  segments: IntroScriptSegment[],
  sessionMode: IntroSessionCaptureMode,
): number {
  return segments.filter((segment) => planSegmentCapture(segment, sessionMode).video).length
}

export function assertVideoCaptureConfigured(
  segments: IntroScriptSegment[],
  sessionMode: IntroSessionCaptureMode,
): void {
  if (sessionMode !== 'video' && sessionMode !== 'both') return
  if (countPlannedVideoSegments(segments, sessionMode) > 0) return
  throw new Error(
    `[intro] video capture enabled but no UI segments are scheduled. ${VIDEO_CAPTURE_EMPTY_HINT}`,
  )
}

export function assertVideoCaptureRecorded(entryCount: number): void {
  if (entryCount > 0) return
  throw new Error(`[intro] video capture produced no scene timings. ${VIDEO_CAPTURE_EMPTY_HINT}`)
}
