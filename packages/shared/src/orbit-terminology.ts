import type { WorkspaceBootstrapStatus } from './types.js'

/** In-product display name for the harness (upstream engine is takt). */
export const ORBIT_DISPLAY_NAME = 'orbit'

/** Canonical workspace sidecar root for UI copy. Includes trailing slash. */
export const ORBIT_DISPLAY_ROOT = '.planetz/orbit/'

export const ORBIT_READY_BANNER = '.planetz/orbit/ is ready — task projection lives.'

export const ORBIT_READY_CLI_UNKNOWN = '.planetz/orbit/ is ready. CLI status is unknown.'

/**
 * Map on-disk `.takt*` path fragments to orbit display strings for UI copy.
 * Intended for path-like values (e.g. `.takt/config.yaml`); do not pass arbitrary prose.
 */
export function toDisplayOrbitPath(input: string): string {
  const displayRoot = ORBIT_DISPLAY_ROOT.replace(/\/$/, '')
  return input
    .replaceAll('.planets/orbit', displayRoot)
    .replace(/\.planetz\/(?!orbit(?:\/|$))/g, `${displayRoot}/`)
    .replace(/\.planetz\b(?!\/)/g, displayRoot)
    .replaceAll('.takt-agent-ui', displayRoot)
    .replaceAll('.orbit/', `${displayRoot}/`)
    .replace(/\.orbit\b/g, displayRoot)
    .replaceAll('.takt/', `${displayRoot}/`)
    .replace(/\.takt\b/g, displayRoot)
}

export function formatBootstrapStatusLabel(status: WorkspaceBootstrapStatus): string {
  switch (status) {
    case 'takt_ready':
      return `${ORBIT_DISPLAY_NAME} ready`
    case 'partial_takt':
      return 'setup required'
    case 'non_takt':
      return 'sidecar missing'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export const BUNDLED_ORBIT_UNAVAILABLE_SHORT =
  'Bundled orbit is unavailable. Prepare bundled assets, then recheck.'

export const BUNDLED_ORBIT_UNAVAILABLE_DASHBOARD =
  'Bundled orbit is unavailable. Verify bundled assets and recheck.'

export const BUNDLED_ORBIT_NOT_FOUND_MESSAGE =
  'Bundled orbit not found. Run `pnpm prepare:bundled-orbit`, then `pnpm debug:bundled-orbit`, and recheck.'

export const BUNDLED_ORBIT_CLI_NOT_FOUND_FIRST_LINE = 'Bundled orbit CLI was not found.'
