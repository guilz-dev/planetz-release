import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DESKTOP_ROOT } from './paths.ts'

/** Committed smoke workspace under `e2e/fixtures/workspaces/smoke`. */
export const SMOKE_WORKSPACE_SOURCE = join(DESKTOP_ROOT, 'e2e/fixtures/workspaces/smoke')

export interface SmokeE2eIsolation {
  workspacePath: string
  userDataPath: string
  cleanup: () => void
}

/** Temp workspace + Electron userData so global UI prefs (e.g. ja) do not leak into smoke. */
export function prepareSmokeE2eIsolation(): SmokeE2eIsolation {
  const root = mkdtempSync(join(tmpdir(), 'planetz-e2e-'))
  const workspacePath = join(root, 'workspace')
  const userDataPath = join(root, 'user-data')
  mkdirSync(userDataPath, { recursive: true })
  cpSync(SMOKE_WORKSPACE_SOURCE, workspacePath, { recursive: true })
  return {
    workspacePath,
    userDataPath,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
