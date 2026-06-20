import type { SettingsUpdateInput, UiConfig, UiPreferences, UiState } from '@planetz/shared'
import { mergeSettingsUpdate, writeLastSelectedModelByProvider } from '@planetz/shared'
import type { AppSession } from '../app-session.js'
import { syncCachedSelectedTaskId } from '../lib/projection/task-projection.js'

type GlobalUiPreferences = Pick<UiPreferences, 'theme' | 'counterPackEnabled' | 'language'>

/** Workspace settings persistence and in-memory UI state. */
export class SessionSettingsService {
  constructor(private readonly session: AppSession) {}

  async updateConfig(patch: SettingsUpdateInput): Promise<UiConfig> {
    const paths = this.session.requireSidecarPaths()
    if (!this.session.config) throw new Error('No workspace open')
    const previousConfig = this.session.config
    const mergedConfig = mergeSettingsUpdate(previousConfig, patch)

    if (patch.ui === undefined) {
      this.session.config = mergedConfig
      try {
        await this.session.sidecarStore.saveConfig(paths, this.session.config)
      } catch (error: unknown) {
        this.session.config = previousConfig
        throw error
      }
      return this.session.config
    }

    this.session.config = mergedConfig
    try {
      await this.session.sidecarStore.saveConfig(paths, this.session.config)
    } catch (error: unknown) {
      this.session.config = previousConfig
      throw error
    }
    try {
      // Seed omitted global fields from the merged workspace config so a partial
      // patch (e.g. Manta mode only) does not resurrect stale global theme/language.
      const globalUi = await this.session.workspaceSessionStore.setGlobalUiPreferences({
        theme: patch.ui.theme ?? mergedConfig.ui.theme,
        counterPackEnabled: patch.ui.counterPackEnabled ?? mergedConfig.ui.counterPackEnabled,
        language: patch.ui.language ?? mergedConfig.ui.language,
      })
      this.session.config = applyGlobalUiPreferences(this.session.config, globalUi)
      await this.session.sidecarStore.saveConfig(paths, this.session.config)
      if (patch.ui.language !== undefined) {
        await this.session.configExecution.syncEngineConfigWithUiLanguage(patch.ui.language)
      }
      return this.session.config
    } catch (error: unknown) {
      this.session.config = previousConfig
      await this.session.sidecarStore.saveConfig(paths, previousConfig).catch(() => {})
      throw error
    }
  }

  async persistUiState(patch: Partial<UiState>): Promise<void> {
    const paths = this.session.requireSidecarPaths()
    const previous = this.session.uiState
    const next = { ...this.session.uiState, ...patch }
    await this.session.sidecarStore.saveUiState(paths, next)
    this.applyUiStateInMemory(next, previous)
  }

  syncUiState(state: UiState): void {
    this.applyUiStateInMemory(state, this.session.uiState)
  }

  async rememberProviderModelSelection(input: { provider: string; model?: string }): Promise<void> {
    const currentSelections = this.session.uiState.lastSelectedModelByProvider
    const nextSelections = writeLastSelectedModelByProvider(
      currentSelections,
      input.provider,
      input.model,
    )
    const providerId = input.provider.trim()
    if (!providerId) return
    if (currentSelections?.[providerId] === nextSelections?.[providerId]) return
    await this.persistUiState({ lastSelectedModelByProvider: nextSelections })
  }

  private applyUiStateInMemory(next: UiState, previous: UiState): void {
    this.session.uiState = next
    if (this.session.cachedState && next.selectedTaskId !== previous.selectedTaskId) {
      const tasks = this.session.mockQueueEnabled()
        ? this.session.mockTasks
        : this.session.cachedState.tasks
      this.session.cachedState = syncCachedSelectedTaskId(this.session.cachedState, next, tasks)
    }
  }
}

function applyGlobalUiPreferences(config: UiConfig, globalUi: GlobalUiPreferences): UiConfig {
  return {
    ...config,
    ui: {
      ...config.ui,
      theme: globalUi.theme,
      counterPackEnabled: globalUi.counterPackEnabled,
      language: globalUi.language,
    },
  }
}
