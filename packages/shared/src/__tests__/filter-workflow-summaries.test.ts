import { describe, expect, it } from 'vitest'
import { getBuiltinWorkflowTierMeta } from '../builtin-workflow-tier.js'
import {
  filterWorkflowSummaries,
  workflowDisplayLabel,
  workflowSummaryLabel,
} from '../filter-workflow-summaries.js'
import type { WorkflowSummary } from '../types.js'

const sample: WorkflowSummary[] = [
  {
    name: 'default',
    source: 'builtin',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  },
  {
    name: 'my-flow',
    source: 'project',
    description: 'Custom deploy pipeline',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  },
]

describe('workflowSummaryLabel', () => {
  it('includes display name for core builtin', () => {
    const meta = getBuiltinWorkflowTierMeta('default')
    expect(workflowDisplayLabel(sample[0], meta)).toBe('Standard Implement (default)')
    expect(workflowSummaryLabel(sample[0])).toBe('Standard Implement (default)')
  })
})

describe('filterWorkflowSummaries', () => {
  it('returns all when query is empty', () => {
    expect(filterWorkflowSummaries('', sample)).toHaveLength(2)
    expect(filterWorkflowSummaries('   ', sample)).toHaveLength(2)
  })

  it('filters by name', () => {
    expect(filterWorkflowSummaries('my', sample).map((w) => w.name)).toEqual(['my-flow'])
  })

  it('filters by description', () => {
    expect(filterWorkflowSummaries('deploy', sample).map((w) => w.name)).toEqual(['my-flow'])
  })

  it('filters by source', () => {
    expect(filterWorkflowSummaries('builtin', sample).map((w) => w.name)).toEqual(['default'])
  })

  it('filters by builtin displayName alias', () => {
    const tierMeta = new Map([['default', getBuiltinWorkflowTierMeta('default')]])
    expect(filterWorkflowSummaries('thorough', sample, tierMeta).map((w) => w.name)).toEqual([])
    expect(filterWorkflowSummaries('standard', sample, tierMeta).map((w) => w.name)).toEqual([
      'default',
    ])
  })

  it('filters by category label', () => {
    const withCategory: WorkflowSummary[] = [
      ...sample,
      {
        name: 'frontend-refactor-mock',
        source: 'builtin',
        categories: ['🎨 Frontend'],
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ]
    expect(filterWorkflowSummaries('frontend', withCategory).map((w) => w.name)).toEqual([
      'frontend-refactor-mock',
    ])
  })
})
