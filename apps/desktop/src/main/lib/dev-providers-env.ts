/** Whether dev-only providers (e.g. mock) may be exposed in UI tooling. */
export function isDevProvidersEnvironment(): boolean {
  const override = process.env.PLANETZ_SHOW_DEV_PROVIDERS?.trim()
  if (override === '1') return true
  if (override === '0') return false
  return process.env.NODE_ENV_ELECTRON_VITE === 'development'
}
