import { AVAILABLE_THEME_IDS, type AvailableThemeId } from './constants.js'

export function parseThemeId(value: string | undefined): AvailableThemeId {
  if (value && (AVAILABLE_THEME_IDS as readonly string[]).includes(value)) {
    return value as AvailableThemeId
  }
  return 'default'
}
