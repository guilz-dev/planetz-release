import { readFileSync } from 'node:fs'
import { INTRO_SCRIPT_PATH } from '../helpers/paths.ts'

export type IntroCaptureMode = 'generated' | 'screenshot' | 'video'

export type IntroVideoCrop = 'intent_rail'

export interface IntroScriptSegment {
  id: string
  scene: string
  narration: string
  capture: IntroCaptureMode
  fallbackScene?: string
  /** Hold after scene actions complete (video timing). */
  recordHoldMs?: number
  /** Fixed segment length in seconds (build mux); when set, overrides audio probe length. */
  durationSec?: number
}

export interface IntroScript {
  version: number
  language: string
  voice: {
    provider?: string
    model: string
    voice: string
  }
  output: {
    width: number
    height: number
    fps: number
  }
  segments: IntroScriptSegment[]
}

export function loadIntroScript(path = INTRO_SCRIPT_PATH): IntroScript {
  const raw = readFileSync(path, 'utf8')
  const parsed = JSON.parse(raw) as IntroScript
  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    throw new Error(`[intro] invalid script: ${path}`)
  }
  return parsed
}
