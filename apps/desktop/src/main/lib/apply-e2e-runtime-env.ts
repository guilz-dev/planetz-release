import { app } from 'electron'

/** Set only by desktop E2E (`apps/desktop/e2e/README.md`); not part of `readPlanetzEnv`. */
export const PLANETZ_E2E_USER_DATA_ENV = 'PLANETZ_E2E_USER_DATA'

/** Isolated Electron profile for smoke tests (avoids global UI prefs leaking into assertions). */
export function applyE2eRuntimeEnvIfConfigured(): void {
  const userData = process.env[PLANETZ_E2E_USER_DATA_ENV]?.trim()
  if (userData) {
    app.setPath('userData', userData)
  }
}
