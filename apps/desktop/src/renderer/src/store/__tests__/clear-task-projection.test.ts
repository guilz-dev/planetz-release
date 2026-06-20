import { describe, expect, it } from 'vitest'
import { minimalAppState } from '../../__tests__/orbit-mock.js'
import { clearTaskProjection } from '../clear-task-projection.js'

describe('clearTaskProjection', () => {
  it('clears task-related projection but keeps workspace metadata', () => {
    const base = minimalAppState({
      agents: [
        {
          id: 'a',
          displayName: 'A',
          runtime: 'takt',
          role: 'coder',
          status: 'idle',
          logTail: [],
          updatedAt: '',
        },
      ],
      tasks: [
        {
          id: 't1',
          title: 'T',
          workflow: 'default',
          priority: 'normal',
          status: 'running',
          source: 'takt',
          createdAt: '',
          updatedAt: '',
        },
      ],
      selectedTaskId: 't1',
    })
    const cleared = clearTaskProjection(base)
    expect(cleared.workspace).toEqual(base.workspace)
    expect(cleared.agents).toEqual([])
    expect(cleared.tasks).toEqual([])
    expect(cleared.selectedTaskId).toBeUndefined()
  })
})
