import { describe, expect, it } from 'vitest'
import { buildExecutionCatalog } from '../execution-catalog.js'
import {
  extractExecutionEffortsFromDocument,
  extractExecutionRefsFromDocument,
} from '../execution-yaml-scan.js'

describe('extractExecutionRefsFromDocument', () => {
  it('reads top-level and step-level provider/model', () => {
    const refs = extractExecutionRefsFromDocument({
      provider: 'codex',
      model: 'gpt-5.2-codex',
      steps: [{ name: 'a', provider: 'cursor', model: 'auto' }],
    })
    expect(refs).toEqual(
      expect.arrayContaining([
        { provider: 'codex', model: 'gpt-5.2-codex' },
        { provider: 'cursor', model: 'auto' },
      ]),
    )
  })

  it('reads workflow_config and rate_limit_fallback', () => {
    const refs = extractExecutionRefsFromDocument({
      workflow_config: { provider: 'claude-sdk', model: 'claude-sonnet-4' },
      rate_limit_fallback: {
        switch_chain: [{ provider: 'mock', model: 'mock-model' }],
      },
    })
    expect(refs).toEqual(
      expect.arrayContaining([
        { provider: 'claude-sdk', model: 'claude-sonnet-4' },
        { provider: 'mock', model: 'mock-model' },
      ]),
    )
  })
})

describe('extractExecutionEffortsFromDocument', () => {
  it('reads provider_options effort leaves', () => {
    const efforts = extractExecutionEffortsFromDocument({
      provider_options: { codex: { reasoning_effort: 'high' } },
      steps: [{ provider_options: { claude: { effort: 'max' } } }],
    })
    expect(efforts).toEqual(
      expect.arrayContaining([
        { provider: 'codex', effort: 'high' },
        { provider: 'claude', effort: 'max' },
      ]),
    )
  })
})

describe('buildExecutionCatalog', () => {
  it('merges engine config and workflow yaml', () => {
    const catalog = buildExecutionCatalog({
      engineConfig: {
        provider: 'cursor',
        model: 'auto',
      },
      workflowYamls: [
        `name: wf
provider: codex
model: gpt-5.2-codex
steps:
  - name: s
    provider: codex
    model: gpt-5
`,
      ],
    })
    expect(catalog.configuredProviders).toContain('cursor')
    expect(catalog.configuredProviders).toContain('codex')
    expect(catalog.modelsByProvider.cursor).toContain('auto')
    expect(catalog.modelsByProvider.codex).toEqual(
      expect.arrayContaining(['gpt-5.2-codex', 'gpt-5']),
    )
    expect(catalog.effortsByProvider).toEqual({})
  })

  it('collects efforts from provider_options', () => {
    const catalog = buildExecutionCatalog({
      engineConfig: {
        provider: 'codex',
        provider_options: { codex: { reasoning_effort: 'medium' } },
      } as import('../engine-config-schema.js').EngineConfig,
    })
    expect(catalog.effortsByProvider.codex).toContain('medium')
  })

  it('registers providers present only in engine provider_options', () => {
    const catalog = buildExecutionCatalog({
      engineConfig: {
        provider: 'cursor',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      } as import('../engine-config-schema.js').EngineConfig,
    })
    expect(catalog.configuredProviders).toContain('cursor')
    expect(catalog.configuredProviders).toContain('ollama')
  })
})
