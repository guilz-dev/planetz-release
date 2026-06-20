import type { PanelId, UiLanguage } from '@planetz/shared'
import { panelTitle } from './catalog.js'

/** Skin override first, then locale catalog (chrome labels). */
export function resolvePanelTitle(
  locale: UiLanguage,
  skinTitles: Partial<Record<PanelId, string>> | undefined,
  panel: PanelId,
): string {
  return skinTitles?.[panel] ?? panelTitle(locale, panel)
}
