import { describe, expect, it } from 'vitest'
import {
  filterUserVisibleWorkflows,
  isUserVisibleWorkflowName,
} from '../workflow-user-visibility.js'

describe('workflow-user-visibility', () => {
  it('hides internal workflow names from user-facing surfaces', () => {
    expect(isUserVisibleWorkflowName('default')).toBe(true)
    expect(isUserVisibleWorkflowName('chat-investigation')).toBe(false)
    expect(isUserVisibleWorkflowName('ollama-chat')).toBe(false)
  })

  it('preserves one hidden workflow name when explicitly requested', () => {
    expect(
      isUserVisibleWorkflowName('ollama-chat', {
        preserveSelectedName: 'ollama-chat',
      }),
    ).toBe(true)
    expect(
      isUserVisibleWorkflowName('chat-investigation', {
        preserveSelectedName: 'ollama-chat',
      }),
    ).toBe(false)
  })

  it('filters hidden workflows regardless of source', () => {
    const workflows = [
      { name: 'default', source: 'builtin' as const },
      { name: 'chat-investigation', source: 'project' as const },
      { name: 'ollama-chat', source: 'project' as const },
      { name: 'custom-review', source: 'project' as const },
    ]

    expect(filterUserVisibleWorkflows(workflows)).toEqual([
      { name: 'default', source: 'builtin' },
      { name: 'custom-review', source: 'project' },
    ])
  })
})
