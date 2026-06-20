import { describe, expect, it } from 'vitest'
import type { WorkflowSummary } from '../types.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'
import {
  BROWSE_LIBRARY_ACTION_NAME,
  BROWSE_LIBRARY_GROUP_KEY,
  buildTierAwareWorkflowGroups,
  buildWorkflowCallTargetGroups,
  CALL_TARGET_LIBRARY_GROUP_KEY,
  CORE_GROUP_KEY,
  ENABLED_LIBRARY_GROUP_KEY,
  isBrowseLibraryAction,
  orderCoreBuiltinWorkflows,
  resolveRecentWorkflowItems,
  sortCoreBuiltinWorkflows,
} from '../workflow-picker-surface.js'

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

describe('resolveRecentWorkflowItems', () => {
  it('preserves recent order and skips unknown names', () => {
    const items = [wf('alpha'), wf('beta'), wf('gamma')]
    expect(
      resolveRecentWorkflowItems(items, ['gamma', 'missing', 'alpha']).map((w) => w.name),
    ).toEqual(['gamma', 'alpha'])
  })
})

describe('buildTierAwareWorkflowGroups', () => {
  const workflows = [
    wf('minimal'),
    wf('default'),
    wf('terraform'),
    wf('ollama-chat'),
    wf('custom', 'project'),
  ]

  it('shows Core and Browse Library when not searching', () => {
    const groups = buildTierAwareWorkflowGroups({
      workflows,
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
    })
    expect(groups.some((g) => g.key === CORE_GROUP_KEY)).toBe(true)
    expect(groups.some((g) => g.key === BROWSE_LIBRARY_GROUP_KEY)).toBe(true)
    const core = groups.find((g) => g.key === CORE_GROUP_KEY)
    expect(core?.items.map((w) => w.name)).toEqual(expect.arrayContaining(['minimal', 'default']))
    expect(core?.items.map((w) => w.name)).not.toContain('terraform')
  })

  it('searches across all tiers', () => {
    const groups = buildTierAwareWorkflowGroups({
      workflows,
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
      query: 'terra',
    })
    expect(groups.some((g) => g.key === BROWSE_LIBRARY_GROUP_KEY)).toBe(false)
    const flat = groups.flatMap((g) => g.items)
    expect(flat.some((w) => w.name === 'terraform')).toBe(true)
  })

  it('hides system builtins from recent and search', () => {
    const groups = buildTierAwareWorkflowGroups({
      workflows,
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
      recentWorkflowNames: ['ollama-chat', 'default'],
    })
    const recent = groups.find((g) => g.key === 'recent')
    expect(recent?.items.map((w) => w.name)).toEqual(['default'])

    const searchGroups = buildTierAwareWorkflowGroups({
      workflows,
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
      query: 'ollama',
    })
    expect(searchGroups.flatMap((g) => g.items)).toEqual([])
  })

  it('hides system workflows even when project-scoped', () => {
    const groups = buildTierAwareWorkflowGroups({
      workflows: [
        wf('minimal'),
        wf('default'),
        wf('ollama-chat', 'project'),
        wf('chat-investigation', 'project'),
        wf('custom', 'project'),
      ],
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
      recentWorkflowNames: ['ollama-chat', 'chat-investigation', 'default'],
    })

    const flatNames = groups.flatMap((g) => g.items).map((w) => w.name)
    expect(flatNames).toContain('default')
    expect(flatNames).toContain('custom')
    expect(flatNames).not.toContain('ollama-chat')
    expect(flatNames).not.toContain('chat-investigation')
  })

  it('exposes browse library pseudo action', () => {
    expect(isBrowseLibraryAction(BROWSE_LIBRARY_ACTION_NAME)).toBe(true)
  })

  it('omits hidden core, pins visible core, and shows implicit library in enabled group', () => {
    const groups = buildTierAwareWorkflowGroups({
      workflows: [wf('minimal'), wf('default'), wf('terraform')],
      prefs: {
        workflowLibrary: {
          ...EMPTY_WORKFLOW_LIBRARY_PREFS,
          implicitEnabledWorkflows: ['terraform'],
        },
        pinnedWorkflows: ['default'],
        hiddenCoreWorkflows: ['minimal'],
      },
      recentWorkflowNames: ['terraform'],
    })
    const core = groups.find((g) => g.key === CORE_GROUP_KEY)
    expect(core?.items.map((w) => w.name)).toEqual(['default'])
    const recent = groups.find((g) => g.key === 'recent')
    expect(recent?.items.map((w) => w.name)).toEqual(['terraform'])
    const enabledLibrary = groups.find((g) => g.key === ENABLED_LIBRARY_GROUP_KEY)
    expect(enabledLibrary?.items.map((w) => w.name)).toEqual(['terraform'])
  })
})

describe('buildWorkflowCallTargetGroups', () => {
  const workflows = [
    wf('minimal'),
    wf('default'),
    wf('terraform'),
    wf('chat-investigation'),
    wf('custom', 'project'),
  ]

  it('includes library workflows without workspace enable', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows })
    const library = groups.find((g) => g.key === CALL_TARGET_LIBRARY_GROUP_KEY)
    expect(library?.items.map((w) => w.name)).toContain('terraform')
    const core = groups.find((g) => g.key === CORE_GROUP_KEY)
    expect(core?.items.map((w) => w.name)).toEqual(expect.arrayContaining(['minimal', 'default']))
  })

  it('excludes system builtins unless preserved', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows })
    const flat = groups.flatMap((g) => g.items)
    expect(flat.some((w) => w.name === 'chat-investigation')).toBe(false)

    const preserved = buildWorkflowCallTargetGroups({
      workflows,
      preserveSelectedName: 'chat-investigation',
    })
    expect(preserved.flatMap((g) => g.items).some((w) => w.name === 'chat-investigation')).toBe(
      true,
    )
  })

  it('excludes project-scoped system workflows unless preserved', () => {
    const workflows = [wf('minimal'), wf('custom', 'project'), wf('ollama-chat', 'project')]
    const groups = buildWorkflowCallTargetGroups({ workflows })
    expect(groups.flatMap((g) => g.items).some((w) => w.name === 'ollama-chat')).toBe(false)

    const preserved = buildWorkflowCallTargetGroups({
      workflows,
      preserveSelectedName: 'ollama-chat',
    })
    expect(preserved.flatMap((g) => g.items).some((w) => w.name === 'ollama-chat')).toBe(true)
  })

  it('includes project workflows', () => {
    const groups = buildWorkflowCallTargetGroups({ workflows })
    expect(
      groups.some((g) => g.key === 'project' && g.items.some((w) => w.name === 'custom')),
    ).toBe(true)
  })

  it('differs from picker groups for unenabled library', () => {
    const pickerGroups = buildTierAwareWorkflowGroups({
      workflows,
      prefs: {
        workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
        pinnedWorkflows: [],
        hiddenCoreWorkflows: [],
      },
    })
    const callGroups = buildWorkflowCallTargetGroups({ workflows })
    expect(pickerGroups.flatMap((g) => g.items).some((w) => w.name === 'terraform')).toBe(false)
    expect(callGroups.flatMap((g) => g.items).some((w) => w.name === 'terraform')).toBe(true)
  })
})

describe('orderCoreBuiltinWorkflows', () => {
  it('does not filter hidden core workflows (settings catalog can unhide)', () => {
    const items = [wf('default'), wf('minimal')]
    const prefs = {
      workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
      pinnedWorkflows: [] as string[],
      hiddenCoreWorkflows: ['minimal'],
    }
    expect(orderCoreBuiltinWorkflows(items, prefs).map((w) => w.name)).toEqual([
      'minimal',
      'default',
    ])
    expect(sortCoreBuiltinWorkflows(items, prefs).map((w) => w.name)).toEqual(['default'])
  })
})

describe('sortCoreBuiltinWorkflows', () => {
  it('pins first and hides filtered core workflows', () => {
    const items = [wf('default'), wf('minimal')]
    const sorted = sortCoreBuiltinWorkflows(items, {
      workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
      pinnedWorkflows: ['default'],
      hiddenCoreWorkflows: ['minimal'],
    })
    expect(sorted.map((w) => w.name)).toEqual(['default'])
  })

  it('orders unpinned core workflows by display rank then name', () => {
    const items = [wf('default'), wf('minimal')]
    const sorted = sortCoreBuiltinWorkflows(items, {
      workflowLibrary: EMPTY_WORKFLOW_LIBRARY_PREFS,
      pinnedWorkflows: [],
      hiddenCoreWorkflows: [],
    })
    expect(sorted.map((w) => w.name)).toEqual(['minimal', 'default'])
  })
})
