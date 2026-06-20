import { describe, expect, it } from 'vitest'
import {
  formatGitHubIssueAsSourceContext,
  formatGitHubPrAsSourceContext,
  normalizeComposerAssistSourceContext,
} from '../composer-source-context.js'
import { COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS } from '../constants.js'

describe('composer-source-context', () => {
  it('formats issue source context with labels and reference', () => {
    const formatted = formatGitHubIssueAsSourceContext({
      repository: { owner: 'acme', name: 'app' },
      number: 42,
      title: 'Login fails',
      body: 'Steps to reproduce',
      url: 'https://github.com/acme/app/issues/42',
      state: 'open',
      labels: ['bug', 'p1'],
    })
    expect(formatted).toContain('## Issue #42: Login fails')
    expect(formatted).toContain('Steps to reproduce')
    expect(formatted).toContain('### Labels')
    expect(formatted).toContain('bug, p1')
    expect(formatted).toContain('https://github.com/acme/app/issues/42')
  })

  it('formats PR source context', () => {
    const formatted = formatGitHubPrAsSourceContext({
      repository: { owner: 'acme', name: 'app' },
      number: 7,
      title: 'Fix login',
      url: 'https://github.com/acme/app/pull/7',
      body: 'Review notes',
    })
    expect(formatted).toContain('## Pull Request #7: Fix login')
    expect(formatted).toContain('Review notes')
  })

  it('truncates source context beyond COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS', () => {
    const oversized = 'x'.repeat(COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS + 100)
    const normalized = normalizeComposerAssistSourceContext(oversized)
    expect(normalized.length).toBeLessThanOrEqual(COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS)
    expect(normalized).toContain('[Source context truncated due to size limit]')
  })
})
