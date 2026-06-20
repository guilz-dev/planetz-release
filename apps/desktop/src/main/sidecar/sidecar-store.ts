import {
  DEFAULT_CONFIG,
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  normalizeUiPreferences,
  type UiConfig,
  type UiState,
  uiConfigSchema,
  uiPreferencesNeedsMigration,
  uiStateSchema,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import { UI_STATE_KV_KEY } from './sidecar-kv-keys.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { writeUiStateKv } from './ui-state-kv.js'

export type { SidecarPaths } from './sidecar-paths.js'
export { resolveSidecarPaths } from './sidecar-paths.js'
export { writeUiStateKv } from './ui-state-kv.js'

const UI_CONFIG_KV_KEY = 'ui.config'

function defaultUiConfig(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { ...DEFAULT_CONFIG.watch },
    ui: {
      ...DEFAULT_CONFIG.ui,
      workflowLibrary: { ...EMPTY_WORKFLOW_LIBRARY_PREFS },
      pinnedWorkflows: [],
      hiddenCoreWorkflows: [],
    },
  }
}

export class SidecarStore {
  async loadConfig(paths: SidecarPaths): Promise<UiConfig> {
    const defaults = defaultUiConfig()
    const stored = await this.readConfigWithCleanup(paths, defaults)
    if (stored) return stored
    await this.saveConfig(paths, defaults)
    return defaults
  }

  async saveConfig(paths: SidecarPaths, config: UiConfig): Promise<void> {
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, UI_CONFIG_KV_KEY, config)
  }

  async loadUiState(paths: SidecarPaths): Promise<UiState> {
    const db = await getSidecarSqlite(paths)
    const parsed = uiStateSchema.safeParse(readKvJson(db, UI_STATE_KV_KEY))
    return parsed.success ? parsed.data : {}
  }

  async saveUiState(paths: SidecarPaths, state: UiState): Promise<void> {
    const db = await getSidecarSqlite(paths)
    writeUiStateKv(db, state)
  }

  private async readConfigWithCleanup(
    paths: SidecarPaths,
    defaults: UiConfig,
  ): Promise<UiConfig | null> {
    const db = await getSidecarSqlite(paths)
    const parsedRaw = readKvJson(db, UI_CONFIG_KV_KEY)

    if (!isRecord(parsedRaw)) return null

    const normalized = uiConfigSchema.safeParse({
      ...defaults,
      ...parsedRaw,
      watch: {
        ...defaults.watch,
        ...(isRecord(parsedRaw.watch) ? parsedRaw.watch : {}),
      },
      ui: normalizeUiPreferences(isRecord(parsedRaw.ui) ? parsedRaw.ui : undefined),
    })

    if (!normalized.success) return null

    const hadLegacyKey = Object.hasOwn(parsedRaw, 'taktCliPath')
    const hadLegacyUiSkin = isRecord(parsedRaw.ui) && uiPreferencesNeedsMigration(parsedRaw.ui)
    if (hadLegacyKey || hadLegacyUiSkin) {
      writeKvJson(db, UI_CONFIG_KV_KEY, normalized.data)
    }

    return normalized.data
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
