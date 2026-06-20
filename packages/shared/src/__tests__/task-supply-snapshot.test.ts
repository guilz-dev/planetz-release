import { describe, expect, it } from 'vitest'
import { taskSupplyTraceItemSchema } from '../task-supply-snapshot.js'

describe('taskSupplyTraceItemSchema', () => {
  it('accepts trace items with resolved suppliedEntries', () => {
    const parsed = taskSupplyTraceItemSchema.parse({
      taskId: 'task-1',
      snapshot: {
        entryIds: ['entry-1'],
        capturedAt: '2026-06-14T00:00:00.000Z',
        matchBasis: 'scope_hint_recompute',
      },
      suppliedEntries: [
        {
          id: 'entry-1',
          taskId: 'other-task',
          sourceRun: 'run-a',
          decisionId: 'd1',
          statement: 'Keep drafts on session switch',
          authority: 'ratified',
          scopeHint: null,
          sourceDoc: null,
          sourceRunDoc: null,
          createdAt: '2026-06-10T00:00:00.000Z',
          ratifiedAt: '2026-06-10T01:00:00.000Z',
          reversibility: null,
          satisfies: null,
          deviates: null,
          unanchored: false,
          scopeConflict: false,
          adjudicationKind: null,
          adjudicationReason: null,
          promotedReqId: null,
        },
      ],
    })

    expect(parsed.suppliedEntries).toHaveLength(1)
    expect(parsed.suppliedEntries?.[0]?.taskId).toBe('other-task')
  })
})
