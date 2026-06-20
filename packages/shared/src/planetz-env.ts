const LEGACY_PREFIX = 'TAKT_AGENT_UI_'
const PREFIX = 'PLANETZ_'

export type PlanetzEnvKey = 'WORKSPACE' | 'MOCK' | 'BUNDLED_ORBIT_ROOT' | 'DRAFT_ROOT'

/** Reads `PLANETZ_*` first, then legacy `TAKT_AGENT_UI_*`. */
export function readPlanetzEnv(key: PlanetzEnvKey): string | undefined {
  const next = process.env[`${PREFIX}${key}`]?.trim()
  if (next) return next
  const legacy = process.env[`${LEGACY_PREFIX}${key}`]?.trim()
  if (legacy) return legacy
  if (key === 'BUNDLED_ORBIT_ROOT') {
    return (
      process.env[`${PREFIX}BUNDLED_TAKT_ROOT`]?.trim() ||
      process.env[`${LEGACY_PREFIX}BUNDLED_TAKT_ROOT`]?.trim() ||
      undefined
    )
  }
  return undefined
}

export function isPlanetzMockEnabled(): boolean {
  return readPlanetzEnv('MOCK') === '1'
}
