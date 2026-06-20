import type { SettingsUpdateInput } from './ipc-schemas.js'
import type { UiConfig } from './schemas.js'
import { normalizeUiOllamaSettings } from './ui-ollama-settings.js'
import { mergeWorkflowLibraryUiPrefs } from './workflow-library-ui.js'

function mergeUiPreferences(
  current: UiConfig['ui'],
  patch: NonNullable<SettingsUpdateInput['ui']>,
): UiConfig['ui'] {
  const { providerSelection, ollama, workflowLibrary, ...rest } = patch
  const next: UiConfig['ui'] = { ...current, ...rest }
  if (providerSelection !== undefined) {
    next.providerSelection = {
      ...current.providerSelection,
      ...providerSelection,
    } as UiConfig['ui']['providerSelection']
  }
  if (ollama !== undefined) {
    next.ollama = normalizeUiOllamaSettings({
      ...current.ollama,
      ...ollama,
    })
  }
  if (workflowLibrary !== undefined) {
    next.workflowLibrary = mergeWorkflowLibraryUiPrefs(current.workflowLibrary, workflowLibrary)
  }
  return next
}

export function mergeSettingsUpdate(config: UiConfig, patch: SettingsUpdateInput): UiConfig {
  return {
    ...config,
    ...(patch.watch !== undefined ? { watch: patch.watch } : {}),
    ...(patch.ui !== undefined ? { ui: mergeUiPreferences(config.ui, patch.ui) } : {}),
  }
}
