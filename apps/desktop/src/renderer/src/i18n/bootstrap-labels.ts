import {
  ORBIT_DISPLAY_NAME,
  ORBIT_DISPLAY_ROOT,
  type UiLanguage,
  type WorkspaceBootstrapStatus,
} from '@planetz/shared'
import { translate } from './catalog.js'

export function formatLocalizedBootstrapStatusLabel(
  locale: UiLanguage,
  status: WorkspaceBootstrapStatus,
): string {
  switch (status) {
    case 'takt_ready':
      return translate(locale, 'bootstrap.orbitReady', { orbit: ORBIT_DISPLAY_NAME })
    case 'partial_takt':
      return translate(locale, 'bootstrap.partialSetup')
    case 'non_takt':
      return translate(locale, 'bootstrap.noOrbitRoot', { root: ORBIT_DISPLAY_ROOT })
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
