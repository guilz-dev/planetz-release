import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { fetchChatFormOptions } from '../fetch-chat-form-options.js'

describe('fetchChatFormOptions', () => {
  beforeEach(() => {
    installOrbitMock()
  })

  it('uses engine config and local git branch list when available', async () => {
    window.orbit.getEngineConfig = vi.fn(async () => ({
      path: '/repo/.planetz/orbit/engine-config.yaml',
      config: { provider: 'claude-sdk', model: 'claude-sonnet-4' },
    }))
    window.orbit.listExecutionCatalog = vi.fn(async () => ({
      configuredProviders: ['claude-sdk'],
      runtimeDetectedProviders: [],
      modelsByProvider: {
        'claude-sdk': ['claude-sonnet-4', 'claude-opus-4'],
      },
      effortsByProvider: {},
    }))
    window.orbit.listWorkspaceGitBranches = vi.fn(async () => ({
      branches: ['develop', 'feature/chat', 'main'],
      currentBranch: 'feature/chat',
    }))
    window.orbit.getWorkspaceCurrentGitBranch = vi.fn(async () => ({ branch: null }))

    const result = await fetchChatFormOptions()

    expect(result.defaultModel).toBe('claude-sonnet-4')
    expect(result.defaultProvider).toBe('claude-sdk')
    expect(result.providers.map((option) => option.value)).toContain('claude-sdk')
    expect(result.models.map((option) => option.value)).toContain('claude-opus-4')
    expect(result.branches).toEqual([
      { value: 'feature/chat', label: 'feature/chat' },
      { value: 'develop', label: 'develop' },
      { value: 'main', label: 'main' },
    ])
    expect(result.defaultBranch).toBe('feature/chat')
  })

  it('recognizes configured default model when engine value has surrounding whitespace', async () => {
    window.orbit.getEngineConfig = vi.fn(async () => ({
      path: '/repo/.planetz/orbit/engine-config.yaml',
      config: { provider: 'claude-sdk', model: ' claude-sonnet-4 ' },
    }))
    window.orbit.listExecutionCatalog = vi.fn(async () => ({
      configuredProviders: ['claude-sdk'],
      runtimeDetectedProviders: [],
      modelsByProvider: {
        'claude-sdk': ['claude-sonnet-4'],
      },
      effortsByProvider: {},
    }))
    window.orbit.listWorkspaceGitBranches = vi.fn(async () => ({
      branches: ['main', 'feature/x'],
      currentBranch: 'main',
    }))
    window.orbit.getWorkspaceCurrentGitBranch = vi.fn(async () => ({ branch: null }))

    const result = await fetchChatFormOptions()

    expect(result.defaultModel).toBe('claude-sonnet-4')
    expect(result.defaultBranch).toBe('main')
  })

  it('falls back to fixtures when engine and branch are unavailable', async () => {
    window.orbit.getEngineConfig = vi.fn(async () => {
      throw new Error('no engine')
    })
    window.orbit.listExecutionCatalog = vi.fn(async () => {
      throw new Error('no catalog')
    })
    window.orbit.listWorkspaceGitBranches = vi.fn(async () => {
      throw new Error('no branch list')
    })
    window.orbit.getWorkspaceCurrentGitBranch = vi.fn(async () => ({ branch: null }))

    const result = await fetchChatFormOptions()

    expect(result.models.length).toBeGreaterThan(0)
    expect(result.branches.length).toBeGreaterThan(0)
    expect(result.defaultBranch).toBe(result.branches[0]?.value)
  })

  it('does not leak configured model into other providers', async () => {
    window.orbit.getEngineConfig = vi.fn(async () => ({
      path: '/repo/.planetz/orbit/engine-config.yaml',
      config: { provider: 'cursor', model: 'composer-2.5' },
    }))
    window.orbit.listExecutionCatalog = vi.fn(async () => ({
      configuredProviders: ['cursor', 'codex'],
      runtimeDetectedProviders: [],
      modelsByProvider: {
        cursor: ['composer-2.5'],
        codex: [],
      },
      effortsByProvider: {},
    }))
    window.orbit.listWorkspaceGitBranches = vi.fn(async () => ({
      branches: ['main'],
      currentBranch: 'main',
    }))
    window.orbit.getWorkspaceCurrentGitBranch = vi.fn(async () => ({ branch: null }))

    const result = await fetchChatFormOptions()
    const codexModels = result.modelsByProvider.codex?.map((option) => option.value) ?? []

    expect(codexModels).toEqual([])
    expect(codexModels).not.toContain('composer-2.5')
  })

  it('prefers provider-scoped live model candidates when available', async () => {
    window.orbit.getEngineConfig = vi.fn(async () => ({
      path: '/repo/.planetz/orbit/engine-config.yaml',
      config: { provider: 'cursor', model: 'composer-2.5' },
    }))
    window.orbit.listExecutionCatalog = vi.fn(async () => ({
      configuredProviders: ['cursor', 'codex'],
      runtimeDetectedProviders: [],
      modelsByProvider: {
        cursor: ['composer-2.5'],
        codex: [],
      },
      effortsByProvider: {},
    }))
    window.orbit.listWorkspaceGitBranches = vi.fn(async () => ({
      branches: ['main'],
      currentBranch: 'main',
    }))
    window.orbit.getWorkspaceCurrentGitBranch = vi.fn(async () => ({ branch: null }))
    window.orbit.listProviderModels = vi.fn(async (input: { provider: string }) => {
      if (input.provider === 'codex') {
        return {
          models: [{ id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex', source: 'live' as const }],
          lastSelectedModel: 'gpt-5.3-codex',
        }
      }
      if (input.provider === 'cursor') {
        return {
          models: [{ id: 'composer-2.5', source: 'workspace' as const }],
          lastSelectedModel: 'composer-2.5',
        }
      }
      return { models: [] }
    })
    window.orbit.listProviderEfforts = vi.fn(async (input: { provider: string }) => {
      if (input.provider === 'codex') {
        return {
          efforts: [{ id: 'high', source: 'suggested' as const }],
        }
      }
      return { efforts: [] }
    })

    const result = await fetchChatFormOptions()
    const codexModels = result.modelsByProvider.codex?.map((option) => option.value) ?? []
    const codexLabels = result.modelsByProvider.codex?.map((option) => option.label) ?? []
    const codexEfforts = result.effortsByProvider.codex?.map((option) => option.value) ?? []

    expect(codexModels).toContain('gpt-5.3-codex')
    expect(codexModels).not.toContain('composer-2.5')
    expect(codexLabels).toContain('gpt-5.3-codex')
    expect(codexLabels).not.toContain('gpt-5.3-codex — GPT-5.3-Codex')
    expect(codexEfforts).toContain('high')
    expect(result.lastSelectedModelByProvider).toEqual({
      codex: 'gpt-5.3-codex',
      cursor: 'composer-2.5',
    })
  })
})
