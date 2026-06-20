import type { PanelId } from '@planetz/shared'
import { useSkin } from '../skins/context'
import { resolvePanelTitle } from './panel-title.js'
import { useI18n } from './use-i18n.js'

/** Panel chrome title: skin override, else locale catalog. */
export function useResolvedPanelTitle(panel: PanelId): string {
  const skin = useSkin()
  const { locale } = useI18n()
  return resolvePanelTitle(locale, skin.panelTitles, panel)
}
