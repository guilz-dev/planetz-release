import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `apps/desktop` root (parent of `e2e/`). */
export const DESKTOP_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Monorepo root (`planetz/`). */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

export const MAIN_ENTRY = join(DESKTOP_ROOT, 'out/main/index.js')

function resolveIntroScriptPath(): string {
  const raw = process.env.PLANETZ_INTRO_SCRIPT?.trim()
  if (!raw) {
    return join(REPO_ROOT, 'docs/marketing/planetz-intro-en.script.json')
  }
  return isAbsolute(raw) ? raw : join(REPO_ROOT, raw)
}

export const INTRO_SCRIPT_PATH = resolveIntroScriptPath()

export const INTRO_ARTIFACTS_DIR = join(REPO_ROOT, 'artifacts/intro')

export const INTRO_SCENES_DIR = join(INTRO_ARTIFACTS_DIR, 'scenes')

export const INTRO_GENERATED_DIR = join(INTRO_ARTIFACTS_DIR, 'generated')

export const INTRO_AUDIO_DIR = join(INTRO_ARTIFACTS_DIR, 'audio')

export const INTRO_RAW_DIR = join(INTRO_ARTIFACTS_DIR, 'raw')

export const INTRO_SESSION_VIDEO_PATH = join(INTRO_RAW_DIR, 'session.webm')

export const INTRO_SCENE_MANIFEST_PATH = join(INTRO_ARTIFACTS_DIR, 'scene-manifest.json')

export const INTRO_SLIDE_BASE_PATH = join(REPO_ROOT, 'docs/marketing/intro-assets/slide-base.png')
