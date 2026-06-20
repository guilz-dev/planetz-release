import { describe, expect, it, vi } from 'vitest'
import { buildComposerSourceContext } from '../session/composer-source-context-builder.js'

describe('buildComposerSourceContext', () => {
  it('fetches and formats issue source context', async () => {
    const fetch = vi.fn(async () => ({
      repository: { owner: 'acme', name: 'app' },
      number: 9,
      title: 'Bug',
      body: 'Details',
      url: 'https://github.com/acme/app/issues/9',
      state: 'open' as const,
      labels: ['bug'],
    }))
    const result = await buildComposerSourceContext(
      {
        githubIssueService: { fetch } as never,
        workspacePath: '/tmp/workspace',
      },
      { kind: 'issue', ref: 'acme/app#9' },
    )
    expect(fetch).toHaveBeenCalledWith({ ref: 'acme/app#9' }, { workspacePath: '/tmp/workspace' })
    expect(result.sourceContext).toContain('## Issue #9: Bug')
    expect(result.sourceContext).toContain('Details')
  })

  it('formats PR source context without fetch', async () => {
    const fetch = vi.fn()
    const result = await buildComposerSourceContext(
      {
        githubIssueService: { fetch } as never,
        workspacePath: null,
      },
      {
        kind: 'pr',
        repository: { owner: 'acme', name: 'app' },
        number: 3,
        title: 'Fix',
        url: 'https://github.com/acme/app/pull/3',
        body: 'PR body',
      },
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(result.sourceContext).toContain('## Pull Request #3: Fix')
    expect(result.sourceContext).toContain('PR body')
  })
})
