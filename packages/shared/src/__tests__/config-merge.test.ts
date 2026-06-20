import { describe, expect, it } from 'vitest'
import { mergeSettingsUpdate } from '../config-merge.js'
import { DEFAULT_CONFIG } from '../constants.js'
import type { UiConfig } from '../schemas.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'

function baseConfig(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { autoStart: true },
    ui: {
      ...DEFAULT_CONFIG.ui,
      workflowLibrary: { ...EMPTY_WORKFLOW_LIBRARY_PREFS },
      pinnedWorkflows: [...DEFAULT_CONFIG.ui.pinnedWorkflows],
      hiddenCoreWorkflows: [...DEFAULT_CONFIG.ui.hiddenCoreWorkflows],
    },
  }
}

describe('mergeSettingsUpdate', () => {
  it('merges nested providerSelection without dropping other ui fields', () => {
    const config = baseConfig()
    const merged = mergeSettingsUpdate(config, {
      ui: {
        providerSelection: { allowedProviderIds: ['cursor', 'copilot'] },
      },
    })
    expect(merged.ui.theme).toBe('default')
    expect(merged.ui.providerSelection).toEqual({
      allowedProviderIds: ['cursor', 'copilot'],
    })
  })
})
