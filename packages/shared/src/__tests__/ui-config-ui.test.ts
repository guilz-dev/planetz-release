import { describe, expect, it } from 'vitest'
import { normalizeUiPreferences, uiPreferencesNeedsMigration } from '../ui-config-ui.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'

const workflowLibraryDefaults = {
  workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
  pinnedWorkflows: [] as string[],
  hiddenCoreWorkflows: [] as string[],
}

describe('normalizeUiPreferences', () => {
  it('defaults when ui block is missing', () => {
    expect(normalizeUiPreferences(undefined)).toEqual({
      theme: 'default',
      counterPackEnabled: false,
      language: 'en',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('maps legacy skin theme id to theme', () => {
    expect(normalizeUiPreferences({ skin: 'andromeda', laneSpeed: 'fast' })).toEqual({
      theme: 'andromeda',
      counterPackEnabled: false,
      language: 'en',
      laneSpeed: 'fast',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('migrates legacy sushi-counter theme to default with counter pack enabled', () => {
    expect(normalizeUiPreferences({ theme: 'sushi-counter', laneSpeed: 'normal' })).toEqual({
      theme: 'default',
      counterPackEnabled: true,
      language: 'en',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('keeps counter pack off when explicitly disabled with legacy sushi-counter theme', () => {
    expect(
      normalizeUiPreferences({
        theme: 'sushi-counter',
        counterPackEnabled: false,
        laneSpeed: 'normal',
      }),
    ).toEqual({
      theme: 'default',
      counterPackEnabled: false,
      language: 'en',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('maps legacy counter-pack skin id to default theme with pack enabled', () => {
    expect(normalizeUiPreferences({ skin: 'sushi', laneSpeed: 'normal' })).toEqual({
      theme: 'default',
      counterPackEnabled: true,
      language: 'en',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('prefers explicit theme and counterPackEnabled over legacy skin', () => {
    expect(
      normalizeUiPreferences({
        skin: 'sushi',
        theme: 'nebula',
        counterPackEnabled: false,
        language: 'ja',
      }),
    ).toEqual({
      theme: 'nebula',
      counterPackEnabled: false,
      language: 'ja',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'direct',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('accepts assist as composer default mode', () => {
    expect(normalizeUiPreferences({ composerAssistDefaultMode: 'assist' })).toEqual({
      theme: 'default',
      counterPackEnabled: false,
      language: 'en',
      laneSpeed: 'normal',
      composerAssistDefaultMode: 'assist',
      workflowLowConfidenceGateEnabled: false,
      ...workflowLibraryDefaults,
      ollama: { toolsGuard: 'block' },
    })
  })

  it('normalizes workflowLibrary partial blocks', () => {
    expect(
      normalizeUiPreferences({
        workflowLibrary: { enabledWorkflows: ['terraform'] },
      }).workflowLibrary.enabledWorkflows,
    ).toEqual(['terraform'])
  })
})

describe('uiPreferencesNeedsMigration', () => {
  it('returns true when legacy skin is present', () => {
    expect(uiPreferencesNeedsMigration({ skin: 'sushi' })).toBe(true)
  })

  it('returns true when legacy sushi-counter theme is present', () => {
    expect(uiPreferencesNeedsMigration({ theme: 'sushi-counter' })).toBe(true)
  })

  it('returns false for normalized ui block', () => {
    expect(uiPreferencesNeedsMigration({ theme: 'default', counterPackEnabled: true })).toBe(false)
  })
})
