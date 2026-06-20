import type { WorkflowSummary } from '@planetz/shared'
import { buildWorkflowCallTargetGroups } from '@planetz/shared'
import { describe, expect, it } from 'vitest'

function wf(name: string, source: WorkflowSummary['source'] = 'builtin'): WorkflowSummary {
  return {
    name,
    source,
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  }
}

describe('workflow call target groups (picker)', () => {
  const workflows = [
    wf('minimal'),
    wf('terraform'),
    wf('chat-investigation'),
    wf('custom', 'project'),
  ]

  it('includes core and library builtins without workspace enable', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows })
    const names = groups.flatMap((group) => group.items.map((item) => item.name))
    expect(names).toEqual(expect.arrayContaining(['minimal', 'terraform', 'custom']))
  })

  it('excludes system builtins unless currently selected', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows })
    const names = groups.flatMap((group) => group.items.map((item) => item.name))
    expect(names).not.toContain('chat-investigation')

    const preserved = buildWorkflowCallTargetGroups({
      workflows,
      preserveSelectedName: 'chat-investigation',
    })
    const preservedNames = preserved.flatMap((group) => group.items.map((item) => item.name))
    expect(preservedNames).toContain('chat-investigation')
  })

  it('filters library workflows by query', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows, query: 'terra' })
    const names = groups.flatMap((group) => group.items.map((item) => item.name))
    expect(names).toEqual(['terraform'])
  })
})
