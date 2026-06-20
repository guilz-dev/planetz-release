import type { UiConfig } from '@planetz/shared'
import { normalizeUiPreferences } from '@planetz/shared'
import { useAppStore } from './app-store'

/** Applies persisted workspace `config.ui` to renderer UI preferences (theme, skin pack, language). */
export function syncUiPreferencesFromConfig(config: UiConfig | null): void {
  if (!config?.ui) return
  const ui = normalizeUiPreferences(config.ui)
  useAppStore.getState().setUiPreferences({
    themeId: ui.theme,
    counterPackEnabled: ui.counterPackEnabled,
    uiLanguage: ui.language,
    composerAssistDefaultMode: ui.composerAssistDefaultMode,
    workflowLowConfidenceGateEnabled: ui.workflowLowConfidenceGateEnabled,
  })
}
