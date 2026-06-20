import type { WorkflowSummary } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  buildWorkflowComboboxGroups,
  collectVisibleWorkflowItems,
  RECENT_GROUP_KEY,
} from '../workflow-combobox-groups.js'

function workflow(name: string, source: WorkflowSummary['source'] = 'project'): WorkflowSummary {
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

describe('workflow-combobox-groups', () => {
  it('prepends Recent when recent names resolve in the catalog', () => {
    const items = [workflow('alpha'), workflow('beta')]
    const groups = buildWorkflowComboboxGroups(items, [], ['beta', 'alpha'])
    expect(groups[0]?.key).toBe(RECENT_GROUP_KEY)
    expect(groups[0]?.items.map((w) => w.name)).toEqual(['beta', 'alpha'])
  })

  it('dedupes visible items so keyboard nav matches first group occurrence', () => {
    const items = [workflow('alpha'), workflow('beta')]
    const groups = buildWorkflowComboboxGroups(items, [], ['beta'])
    const visible = collectVisibleWorkflowItems(groups, true, new Set(), null)
    expect(visible.map((w) => w.name)).toEqual(['beta', 'alpha'])
  })
})
