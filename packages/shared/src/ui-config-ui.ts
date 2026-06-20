import {
  AVAILABLE_THEME_IDS,
  type AvailableThemeId,
  type ComposerAssistDefaultMode,
  DEFAULT_CONFIG,
  LEGACY_COUNTER_PACK_SKIN_ID,
  LEGACY_SUSHI_COUNTER_THEME_ID,
} from './constants.js'
import { normalizeProviderSelection, type UiProviderSelection } from './provider-selection.js'
import { parseThemeId } from './theme-id.js'
import { normalizeUiOllamaSettings, type UiOllamaSettings } from './ui-ollama-settings.js'
import {
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  normalizeStringList,
  normalizeWorkflowLibraryUiPrefs,
  type WorkflowLibraryUiPrefs,
} from './workflow-library-ui.js'

export const UI_LANGUAGE_IDS = ['en', 'ja'] as const
export type UiLanguage = (typeof UI_LANGUAGE_IDS)[number]

export type { UiProviderSelection } from './provider-selection.js'

export type { OllamaToolsGuardMode, UiOllamaSettings } from './ui-ollama-settings.js'

export type { WorkflowLibraryUiPrefs } from './workflow-library-ui.js'

export type UiPreferences = {
  theme: AvailableThemeId
  counterPackEnabled: boolean
  language: UiLanguage
  laneSpeed: 'slow' | 'normal' | 'fast'
  composerAssistDefaultMode: ComposerAssistDefaultMode
  /** When true, low-confidence auto routing prompts before enqueue (opt-in). */
  workflowLowConfidenceGateEnabled: boolean
  workflowLibrary: WorkflowLibraryUiPrefs
  pinnedWorkflows: string[]
  hiddenCoreWorkflows: string[]
  providerSelection?: UiProviderSelection
  ollama?: UiOllamaSettings
}

function parseUiLanguage(value: unknown): UiLanguage {
  return value === 'ja' ? 'ja' : 'en'
}

function parseLaneSpeed(value: unknown): UiPreferences['laneSpeed'] {
  if (value === 'slow' || value === 'fast') return value
  return 'normal'
}

function parseComposerAssistDefaultMode(value: unknown): ComposerAssistDefaultMode {
  return value === 'assist' ? 'assist' : 'direct'
}

/**
 * Normalizes persisted `ui` blocks, including legacy `skin` (pre theme/skin split).
 * Legacy counter-pack skin id enables manta mode and defaults theme to `default`.
 */
export function normalizeUiPreferences(raw: unknown): UiPreferences {
  const defaults: UiPreferences = {
    ...DEFAULT_CONFIG.ui,
    workflowLibrary: { ...EMPTY_WORKFLOW_LIBRARY_PREFS },
    pinnedWorkflows: [...DEFAULT_CONFIG.ui.pinnedWorkflows],
    hiddenCoreWorkflows: [...DEFAULT_CONFIG.ui.hiddenCoreWorkflows],
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ...defaults }
  }

  const record = raw as Record<string, unknown>
  const legacySkin = typeof record.skin === 'string' ? record.skin : undefined
  const legacyTheme = typeof record.theme === 'string' ? record.theme : undefined

  let theme = parseThemeId(legacyTheme)
  const explicitCounterPack = record.counterPackEnabled
  let counterPackEnabled = explicitCounterPack === true

  const legacyCounterPackTheme = legacyTheme === LEGACY_SUSHI_COUNTER_THEME_ID
  const legacyCounterPackSkin = legacySkin === LEGACY_COUNTER_PACK_SKIN_ID

  if (legacyCounterPackTheme) {
    theme = 'default'
    if (explicitCounterPack !== false) {
      counterPackEnabled = true
    }
  } else if (legacyCounterPackSkin) {
    if (explicitCounterPack !== false) {
      counterPackEnabled = true
    }
    if (record.theme === undefined) {
      theme = 'default'
    }
  } else if (legacySkin && record.theme === undefined) {
    theme = parseThemeId(legacySkin)
  }

  if (
    legacySkin &&
    legacySkin !== LEGACY_COUNTER_PACK_SKIN_ID &&
    !(AVAILABLE_THEME_IDS as readonly string[]).includes(legacySkin)
  ) {
    theme = 'default'
  }

  const providerSelection = normalizeProviderSelection(record.providerSelection)
  const ollama = normalizeUiOllamaSettings(record.ollama)

  return {
    theme,
    counterPackEnabled,
    language: parseUiLanguage(record.language),
    laneSpeed: parseLaneSpeed(record.laneSpeed),
    composerAssistDefaultMode: parseComposerAssistDefaultMode(record.composerAssistDefaultMode),
    workflowLowConfidenceGateEnabled: record.workflowLowConfidenceGateEnabled === true,
    workflowLibrary: normalizeWorkflowLibraryUiPrefs(record.workflowLibrary),
    pinnedWorkflows: normalizeStringList(record.pinnedWorkflows),
    hiddenCoreWorkflows: normalizeStringList(record.hiddenCoreWorkflows),
    ollama,
    ...(providerSelection ? { providerSelection } : {}),
  }
}

/** Merge normalized UI preferences with optional workspace provider allowlist. */
export function normalizeUiBlock(raw: unknown): UiPreferences {
  return normalizeUiPreferences(raw)
}

export function uiPreferencesNeedsMigration(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const record = raw as Record<string, unknown>
  if (Object.hasOwn(record, 'skin')) return true
  return record.theme === LEGACY_SUSHI_COUNTER_THEME_ID
}
