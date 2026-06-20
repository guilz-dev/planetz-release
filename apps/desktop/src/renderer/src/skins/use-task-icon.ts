import type { ComponentType, SVGProps } from 'react'

/**
 * Renderer-side icon registry for task visualization. Components access this via
 * `useTaskIcon` so they never import skin-specific modules directly.
 *
 * Currently unused (icons were only used by the legacy sushi pack). Kept as stub for
 * future skin extensions that may provide task icons.
 */
export function useTaskIcon(
  _iconId: string | undefined,
): ComponentType<SVGProps<SVGSVGElement>> | undefined {
  // Stub: no icons currently mapped.
  return undefined
}
