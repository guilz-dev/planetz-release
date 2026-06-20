const WINDOW_SIZE_PATTERN = /^(\d{3,5})x(\d{3,5})$/

/** Set by intro video capture E2E so BrowserWindow matches Playwright recordVideo size. */
export const PLANETZ_E2E_WINDOW_SIZE_ENV = 'PLANETZ_E2E_WINDOW_SIZE'

export function parseE2eWindowSize(
  raw: string | undefined,
): { width: number; height: number } | null {
  const value = raw?.trim()
  if (!value) return null
  const match = WINDOW_SIZE_PATTERN.exec(value)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width < 800 || height < 600) return null
  return { width, height }
}

export function resolveE2eWindowSizeFromEnv(): { width: number; height: number } | null {
  return parseE2eWindowSize(process.env[PLANETZ_E2E_WINDOW_SIZE_ENV])
}
