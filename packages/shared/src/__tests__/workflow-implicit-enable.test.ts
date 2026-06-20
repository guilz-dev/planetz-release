import { describe, expect, it } from 'vitest'
import { mergeImplicitLibraryWorkflows } from '../workflow-implicit-enable.js'
import { EMPTY_WORKFLOW_LIBRARY_PREFS } from '../workflow-library-ui.js'

describe('mergeImplicitLibraryWorkflows', () => {
  it('adds library builtin candidates not already enabled or dismissed', () => {
    const workflowsByName = new Map([
      ['terraform', 'builtin' as const],
      ['default', 'builtin' as const],
    ])
    const result = mergeImplicitLibraryWorkflows(
      EMPTY_WORKFLOW_LIBRARY_PREFS,
      ['terraform', 'default'],
      workflowsByName,
    )
    expect(result.changed).toBe(true)
    expect(result.prefs.implicitEnabledWorkflows).toEqual(['terraform'])
  })
})
