import { describe, expect, it } from 'vitest'
import {
  buildIssueTaskDraft,
  buildIssueTaskTitle,
  extractGitHubIssueErrorCode,
  formatGitHubIssueErrorMessage,
  formatIssueRefKey,
  githubIssueListOpenResultSchema,
  normalizeIssueNumber,
  normalizeIssueRef,
  parseIssueRefFromTaskTitle,
  parseIssueRefKey,
  resolveTaskIssueNumber,
  resolveTaskIssueRef,
  truncateIssueBodyForDraft,
} from '../github-issue-types.js'

describe('github-issue-types', () => {
  const sampleIssue = {
    repository: { owner: 'guilz-dev', name: 'planetz' },
    number: 368,
    title: 'Zero-defect gate',
    body: 'Body text',
    url: 'https://github.com/guilz-dev/planetz/issues/368',
    state: 'open' as const,
    labels: ['enhancement'],
    author: 'kaz',
  }

  it('formats and extracts github issue error codes', () => {
    const message = formatGitHubIssueErrorMessage('gh_auth_required', 'not logged in')
    expect(message).toBe('[github-issue:gh_auth_required] not logged in')
    expect(extractGitHubIssueErrorCode(new Error(message))).toBe('gh_auth_required')
  })

  it('builds task draft and title from issue view', () => {
    expect(buildIssueTaskTitle(sampleIssue)).toBe('[guilz-dev/planetz#368] Zero-defect gate')
    expect(buildIssueTaskDraft(sampleIssue)).toContain('[GitHub Issue] guilz-dev/planetz#368')
    expect(buildIssueTaskDraft(sampleIssue)).toContain('Body text')
  })

  it('formats issue ref keys and parses task title prefixes', () => {
    expect(formatIssueRefKey(sampleIssue.repository, sampleIssue.number)).toBe(
      'guilz-dev/planetz#368',
    )
    expect(parseIssueRefKey('guilz-dev/planetz#368')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
      number: 368,
    })
    expect(parseIssueRefFromTaskTitle('[guilz-dev/planetz#368] Zero-defect gate')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
      number: 368,
    })
    expect(parseIssueRefFromTaskTitle('Composer task without issue prefix')).toBeNull()
    expect(parseIssueRefFromTaskTitle('[repo#1] Missing owner')).toBeNull()
    expect(parseIssueRefFromTaskTitle('')).toBeNull()
  })

  it('prefers explicit issue metadata and falls back to legacy title parsing', () => {
    expect(normalizeIssueNumber(368)).toBe(368)
    expect(normalizeIssueNumber(0)).toBeUndefined()
    expect(normalizeIssueRef('guilz-dev/planetz#368')).toBe('guilz-dev/planetz#368')
    expect(normalizeIssueRef('invalid')).toBeUndefined()
    expect(resolveTaskIssueRef({ title: 'Plain task', issueRef: 'guilz-dev/planetz#368' })).toBe(
      'guilz-dev/planetz#368',
    )
    expect(resolveTaskIssueRef({ title: '[guilz-dev/planetz#369] Legacy issue task' })).toBe(
      'guilz-dev/planetz#369',
    )
    expect(resolveTaskIssueNumber({ title: 'Plain task', issueNumber: 368 })).toBe(368)
    expect(resolveTaskIssueNumber({ title: 'Plain task', issueRef: 'guilz-dev/planetz#370' })).toBe(
      370,
    )
    expect(resolveTaskIssueNumber({ title: '[guilz-dev/planetz#369] Legacy issue task' })).toBe(369)
    expect(resolveTaskIssueNumber({ title: 'No issue link' })).toBeUndefined()
  })

  it('truncates long issue bodies in draft template', () => {
    const longBody = 'x'.repeat(20_000)
    const truncated = truncateIssueBodyForDraft(longBody, 100)
    expect(truncated.endsWith('(truncated)')).toBe(true)
    expect(truncated.length).toBeLessThan(longBody.length)
  })

  it('accepts open-issue list response schema', () => {
    const parsed = githubIssueListOpenResultSchema.parse({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [
        {
          repository: { owner: 'guilz-dev', name: 'planetz' },
          number: 368,
          title: 'Zero-defect gate',
          url: 'https://github.com/guilz-dev/planetz/issues/368',
          createdAt: '2026-05-31T03:00:00Z',
          state: 'open',
          labels: ['enhancement'],
          author: 'kaz',
        },
      ],
      pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
    })
    expect(parsed.items[0]?.number).toBe(368)
    expect(parsed.pageInfo.hasNextPage).toBe(true)
  })
})
