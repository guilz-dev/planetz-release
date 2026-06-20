import { describe, expect, it } from 'vitest'
import {
  filterChatThreadsByTitle,
  mergeChatThreadSearchResults,
  mergeThreadsForSendLookup,
} from '../chat-thread-search'

const thread = (
  id: string,
  title: string,
): {
  id: string
  title: string
  workspacePath: string
  workspaceLabel: string
  updatedAt: string
  hasActiveSession: boolean
} => ({
  id,
  title,
  workspacePath: '/repo',
  workspaceLabel: 'repo',
  updatedAt: '2026-06-01T00:00:00.000Z',
  hasActiveSession: true,
})

describe('chat-thread-search', () => {
  it('filters threads by title substring', () => {
    const threads = [thread('a', 'Auth flow'), thread('b', 'Billing')]
    expect(filterChatThreadsByTitle(threads, 'auth').map((t) => t.id)).toEqual(['a'])
  })

  it('merges display-only threads into send lookup without dropping canonical rows', () => {
    const all = [thread('a', 'Listed')]
    const display = [thread('a', 'Listed'), thread('remote', 'Remote only')]
    const lookup = mergeThreadsForSendLookup(all, display)
    expect(lookup.map((t) => t.id).sort()).toEqual(['a', 'remote'])
  })

  it('merges remote and local without duplicate ids', () => {
    const remote = [thread('r1', 'Remote hit')]
    const local = [thread('r1', 'Remote hit'), thread('l1', 'Local only')]
    const merged = mergeChatThreadSearchResults(remote, local)
    expect(merged.map((t) => t.id)).toEqual(['r1', 'l1'])
  })
})
