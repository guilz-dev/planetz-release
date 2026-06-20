import { describe, expect, it } from 'vitest'
import { formatWorkspaceTabLabel, pickCloseFallbackPath } from '../workspace-tab-labels.js'
import type { WorkspaceUiTab } from '../workspace-ui-tab.js'

describe('formatWorkspaceTabLabel', () => {
  it('returns basename when names are unique', () => {
    const tabs: WorkspaceUiTab[] = [
      { path: '/work/a', name: 'a' },
      { path: '/work/b', name: 'b' },
    ]
    expect(formatWorkspaceTabLabel(tabs[0]!, tabs)).toBe('a')
  })

  it('adds parent suffix when basenames collide', () => {
    const tabs: WorkspaceUiTab[] = [
      { path: '/clients/acme/repo', name: 'repo' },
      { path: '/clients/beta/repo', name: 'repo' },
    ]
    expect(formatWorkspaceTabLabel(tabs[0]!, tabs)).toBe('repo · clients/acme')
    expect(formatWorkspaceTabLabel(tabs[1]!, tabs)).toBe('repo · clients/beta')
  })
})

describe('pickCloseFallbackPath', () => {
  const tabs: WorkspaceUiTab[] = [
    { path: '/a', name: 'a' },
    { path: '/b', name: 'b' },
    { path: '/c', name: 'c' },
  ]

  it('prefers left neighbor for active tab', () => {
    expect(pickCloseFallbackPath(tabs, '/b')).toBe('/a')
  })

  it('falls back to right neighbor when closing first tab', () => {
    expect(pickCloseFallbackPath(tabs, '/a')).toBe('/b')
  })

  it('returns null for unknown path', () => {
    expect(pickCloseFallbackPath(tabs, '/missing')).toBeNull()
  })
})
