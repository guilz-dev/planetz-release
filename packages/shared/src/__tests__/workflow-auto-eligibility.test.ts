import { describe, expect, it } from 'vitest'
import {
  isRuntimeAutoEligible,
  listRuntimeAutoEligibleNames,
} from '../workflow-auto-eligibility.js'
import type { WorkflowRoutingCatalog } from '../workflow-auto-routing-schema.js'
import { ROUTING_GROUPS } from '../workflow-auto-routing-schema.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'

const catalog: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [
    { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
    { name: 'terraform', enabledForAuto: false, routingGroups: ['ops'] },
    { name: 'my-flow', enabledForAuto: false, routingGroups: ['general'] },
  ],
}

describe('isRuntimeAutoEligible', () => {
  it('allows core builtin when catalog enables auto', () => {
    expect(
      isRuntimeAutoEligible(
        'default',
        'builtin',
        catalog.workflows[0],
        EMPTY_WORKFLOW_LIBRARY_PREFS,
      ),
    ).toBe(true)
  })

  it('blocks library builtin unless autoEnabledWorkflows lists it', () => {
    const entry = catalog.workflows.find((w) => w.name === 'terraform')
    expect(isRuntimeAutoEligible('terraform', 'builtin', entry, EMPTY_WORKFLOW_LIBRARY_PREFS)).toBe(
      false,
    )
    expect(
      isRuntimeAutoEligible('terraform', 'builtin', entry, {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        autoEnabledWorkflows: ['terraform'],
      }),
    ).toBe(true)
  })

  it('does not apply pack enable to auto', () => {
    const entry = catalog.workflows.find((w) => w.name === 'terraform')
    expect(
      isRuntimeAutoEligible('terraform', 'builtin', entry, {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        enabledPacks: ['infra'],
      }),
    ).toBe(false)
  })

  it('uses catalog flag or ui override for project workflows', () => {
    const entry = catalog.workflows.find((w) => w.name === 'my-flow')
    expect(isRuntimeAutoEligible('my-flow', 'project', entry, EMPTY_WORKFLOW_LIBRARY_PREFS)).toBe(
      false,
    )
    expect(
      isRuntimeAutoEligible('my-flow', 'project', entry, {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        autoEnabledWorkflows: ['my-flow'],
      }),
    ).toBe(true)
  })
})

describe('listRuntimeAutoEligibleNames', () => {
  it('merges core catalog and library autoEnabled', () => {
    const workflowsByName = new Map([
      ['default', 'builtin' as const],
      ['terraform', 'builtin' as const],
      ['my-flow', 'project' as const],
    ])
    const names = listRuntimeAutoEligibleNames({
      catalog,
      availableWorkflowNames: ['default', 'terraform', 'my-flow'],
      workflowsByName,
      uiPrefs: { ...EMPTY_WORKFLOW_LIBRARY_PREFS, autoEnabledWorkflows: ['terraform', 'my-flow'] },
    })
    expect(names).toEqual(['default', 'terraform', 'my-flow'])
  })
})
