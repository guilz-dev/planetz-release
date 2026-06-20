import type { ChainGroup } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { chainGroupsEqual } from '../lib/chain/chain-groups-equal.js'
import {
  removeChainEdge,
  syncChainEdgeStatuses,
  syncChainGroupsWithTaskIds,
  upsertChainEdge,
} from '../lib/chain/chain-mutations.js'
import { buildChainTaskEnqueueBody } from '../lib/chain/chain-planned-enqueue.js'

describe('chain-mutations', () => {
  it('upsertEdge creates a chain and links tasks', () => {
    const { groups, chainId } = upsertChainEdge([], {
      edge: {
        fromTaskId: 'a',
        toTaskId: 'b',
        mode: 'branch_handoff',
        status: 'ready_to_create',
      },
    })
    expect(chainId).toBe('chain-a')
    expect(groups).toHaveLength(1)
    expect(groups[0].edges).toHaveLength(1)
    expect(groups[0].taskIds).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('marks edges invalid when a task id is missing', () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a', 'b'],
        edges: [
          {
            fromTaskId: 'a',
            toTaskId: 'b',
            mode: 'branch_handoff',
            status: 'ready_to_create',
          },
        ],
      },
    ]
    const next = syncChainGroupsWithTaskIds(groups, new Set(['a']))
    expect(next[0].edges[0].status).toBe('invalid')
  })

  it('syncChainEdgeStatuses moves waiting to ready when upstream completes', () => {
    const groups = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'waiting_for_dependency' as const,
            planned: { title: 'Next', mode: 'branch_handoff' as const },
          },
        ],
      },
    ]
    const tasksById = new Map([
      [
        'a',
        {
          id: 'a',
          title: 'A',
          status: 'completed' as const,
          priority: 'normal' as const,
          source: 'user' as const,
          createdAt: '',
          updatedAt: '',
        },
      ],
    ])
    const next = syncChainEdgeStatuses(groups, tasksById, new Set(['a']))
    expect(next[0].edges[0].status).toBe('ready_to_create')
  })

  it('chainGroupsEqual ignores edge order', () => {
    const a = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a', 'b'],
        edges: [
          {
            fromTaskId: 'a',
            toTaskId: 'b',
            mode: 'branch_handoff' as const,
            status: 'ready_to_create' as const,
          },
        ],
      },
    ]
    const b = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['b', 'a'],
        edges: [
          {
            fromTaskId: 'a',
            toTaskId: 'b',
            mode: 'branch_handoff' as const,
            status: 'ready_to_create' as const,
          },
        ],
      },
    ]
    expect(chainGroupsEqual(a, b)).toBe(true)
  })

  it('buildChainTaskEnqueueBody includes branch metadata', () => {
    const body = buildChainTaskEnqueueBody(
      {
        title: 'Next',
        body: 'Do the thing',
        mode: 'branch_handoff',
        sourceBranch: 'feature/x',
        baseBranch: 'main',
      },
      { id: 'task-a', title: 'Upstream' },
    )
    expect(body).toContain('Do the thing')
    expect(body).toContain('Source branch: feature/x')
    expect(body).toContain('Upstream task: task-a')
  })

  it('removeChainEdge drops empty chains', () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a', 'b'],
        edges: [
          {
            fromTaskId: 'a',
            toTaskId: 'b',
            mode: 'branch_handoff',
            status: 'ready_to_create',
          },
        ],
      },
    ]
    const next = removeChainEdge(groups, 'chain-a', 'a', 'b')
    expect(next).toHaveLength(0)
  })
})
