import type { AvailableThemeId, SkinDefinition } from '@planetz/shared'
import { andromedaSkin } from './andromeda-skin'
import { defaultSkin } from './default-skin'
import { nebulaSkin } from './nebula-skin'
import { operationsSkin } from './operations-skin'
import { supernovaSkin } from './supernova-skin'

const THEMES = {
  default: defaultSkin,
  operations: operationsSkin,
  andromeda: andromedaSkin,
  nebula: nebulaSkin,
  supernova: supernovaSkin,
} satisfies Record<AvailableThemeId, SkinDefinition>

/** @deprecated Use {@link resolveTheme}. Kept for any legacy call sites. */
export function resolveSkin(skinId: string): SkinDefinition {
  return resolveTheme(skinId)
}

export function resolveTheme(themeId: string): SkinDefinition {
  return THEMES[themeId as AvailableThemeId] ?? defaultSkin
}

export const AVAILABLE_THEMES = Object.values(THEMES).sort((a, b) =>
  a.displayName.localeCompare(b.displayName, 'en'),
)

/** Union of CSS custom properties any theme may override on :root. */
const THEME_TOKEN_KEYS = [...new Set(Object.values(THEMES).flatMap((s) => Object.keys(s.tokens)))]

export function applySkinTokens(root: HTMLElement, skin: SkinDefinition): void {
  for (const key of THEME_TOKEN_KEYS) {
    const value = skin.tokens[key]
    if (value !== undefined) {
      root.style.setProperty(key, value)
    } else {
      root.style.removeProperty(key)
    }
  }
}
