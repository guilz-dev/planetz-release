import type { AvailableSkinId } from './constants.js'
import { LEGACY_COUNTER_PACK_SKIN_ID } from './constants.js'
import { parseThemeId } from './theme-id.js'

/** @deprecated Use {@link parseThemeId} for color themes. Maps legacy counter pack skin id to `default`. */
export function parseSkinId(value: string): AvailableSkinId {
  if (value === LEGACY_COUNTER_PACK_SKIN_ID) return 'default'
  return parseThemeId(value)
}
