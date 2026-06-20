import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { type ComposerSessionMode, isOrbitInteractiveAssistEnabled } from '@planetz/shared'
import { resolveRunnableBundledOrbitRoot } from '../takt/exec-cli.js'

/** Whether bundled orbit ships a built headless interactive entrypoint. */
export function isHeadlessInteractiveRunnerReady(): boolean {
  try {
    const orbitRoot = resolveRunnableBundledOrbitRoot()
    return existsSync(join(orbitRoot, 'dist/features/interactive/headlessSession.js'))
  } catch {
    return false
  }
}

/** Preferred assist start mode for renderer (matches main `shouldUseHeadlessInteractive` defaults). */
export function resolveComposerAssistStartMode(): ComposerSessionMode {
  if (isOrbitInteractiveAssistEnabled() || isHeadlessInteractiveRunnerReady()) {
    return 'interactive-assistant'
  }
  return 'planning-only'
}
