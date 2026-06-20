import { describe, expect, it } from 'vitest'
import { getBuiltinWorkflowTierMeta } from '../builtin-workflow-tier.js'
import {
  canEnablePackInWorkspace,
  canEnableWorkflowForAuto,
  canEnableWorkflowInWorkspace,
  partitionPackBrowseItems,
} from '../workflow-enable-guards.js'

describe('workflow-enable-guards', () => {
  it('allows core and active library workflows in workspace', () => {
    expect(canEnableWorkflowInWorkspace('minimal')).toEqual({ allowed: true })
    expect(canEnableWorkflowInWorkspace('terraform')).toEqual({ allowed: true })
  })

  it('rejects deprecated workflows for new enable', () => {
    expect(canEnableWorkflowInWorkspace('draft')).toEqual({
      allowed: false,
      reason: 'deprecated',
    })
    expect(canEnableWorkflowForAuto('draft')).toEqual({
      allowed: false,
      reason: 'deprecated',
    })
  })

  it('rejects pack enable when every catalog member is deprecated', () => {
    expect(canEnablePackInWorkspace(['draft', 'default-draft', 'compound-eye'])).toEqual({
      allowed: false,
      reason: 'deprecated',
    })
    expect(canEnablePackInWorkspace(['draft', 'terraform'])).toEqual({ allowed: true })
  })

  it('partitions pack browse rows by deprecated lifecycle', () => {
    const { active, deprecated } = partitionPackBrowseItems([
      { name: 'terraform' },
      { name: 'draft' },
    ])
    expect(active.map((row) => row.name)).toEqual(['terraform'])
    expect(deprecated.map((row) => row.name)).toEqual(['draft'])
  })

  it('marks default-mini overlay display metadata', () => {
    const meta = getBuiltinWorkflowTierMeta('default-mini')
    expect(meta.displayName).toBe('Standard Implement (mini)')
    expect(meta.tierReason).toBe('Shorter variant of default')
  })
})
