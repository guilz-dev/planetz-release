import { describe, expect, it } from 'vitest'
import type { WorkflowSummary } from '../types.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'
import {
  isExplicitlyEnabledLibraryWorkflow,
  isImplicitEnabledLibraryWorkflow,
  resolvePickerVisibleLibraryNames,
  shouldShowImplicitEnableBadge,
} from '../workflow-library-visibility.js'

function builtin(name: string): WorkflowSummary {
  return {
    name,
    source: 'builtin',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  }
}

describe('resolvePickerVisibleLibraryNames', () => {
  const workflows = [builtin('terraform'), builtin('minimal'), builtin('draft')]

  it('includes explicitly enabled workflows and non-deprecated pack members', () => {
    const names = resolvePickerVisibleLibraryNames(workflows, {
      ...EMPTY_WORKFLOW_LIBRARY_PREFS,
      enabledWorkflows: ['terraform'],
      enabledPacks: ['experimental'],
    })
    expect(names).toContain('terraform')
    expect(names).not.toContain('draft')
    expect(names).not.toContain('minimal')
  })

  it('keeps deprecated workflows visible when explicitly enabled', () => {
    const names = resolvePickerVisibleLibraryNames(workflows, {
      ...EMPTY_WORKFLOW_LIBRARY_PREFS,
      enabledWorkflows: ['draft'],
    })
    expect(names).toEqual(['draft'])
  })

  it('includes implicit minus dismissed', () => {
    const names = resolvePickerVisibleLibraryNames(workflows, {
      ...EMPTY_WORKFLOW_LIBRARY_PREFS,
      implicitEnabledWorkflows: ['terraform', 'draft'],
      dismissedImplicitWorkflows: ['draft'],
    })
    expect(names).toEqual(['terraform'])
  })
})

describe('explicit / implicit helpers', () => {
  it('does not treat deprecated workflows as pack-enabled', () => {
    expect(
      isExplicitlyEnabledLibraryWorkflow('draft', {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        enabledPacks: ['experimental'],
      }),
    ).toBe(false)
  })

  it('keeps deprecated workflows visible when explicitly listed', () => {
    expect(
      isExplicitlyEnabledLibraryWorkflow('draft', {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        enabledWorkflows: ['draft'],
      }),
    ).toBe(true)
  })

  it('detects implicit enable when not dismissed', () => {
    expect(
      isImplicitEnabledLibraryWorkflow('terraform', {
        ...EMPTY_WORKFLOW_LIBRARY_PREFS,
        implicitEnabledWorkflows: ['terraform'],
      }),
    ).toBe(true)
  })

  it('shows implicit badge only when implicit and not explicit', () => {
    const prefs = {
      ...EMPTY_WORKFLOW_LIBRARY_PREFS,
      implicitEnabledWorkflows: ['terraform'],
    }
    expect(shouldShowImplicitEnableBadge('terraform', prefs)).toBe(true)
    expect(
      shouldShowImplicitEnableBadge('terraform', {
        ...prefs,
        enabledWorkflows: ['terraform'],
      }),
    ).toBe(false)
  })
})
