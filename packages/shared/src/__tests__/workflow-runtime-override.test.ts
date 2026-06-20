import { describe, expect, it } from 'vitest'
import {
  isRuntimeMaterializedWorkflowName,
  RUNTIME_WORKFLOW_OVERRIDE_SUFFIX,
  runtimeWorkflowOverrideName,
  stripRuntimeWorkflowOverrideSuffix,
} from '../workflow-runtime-override.js'

describe('workflow-runtime-override', () => {
  it('strips override suffix from materialized workflow names', () => {
    const base = 'minimal'
    const materialized = runtimeWorkflowOverrideName(base)
    expect(materialized).toBe(`minimal${RUNTIME_WORKFLOW_OVERRIDE_SUFFIX}`)
    expect(stripRuntimeWorkflowOverrideSuffix(materialized)).toBe(base)
  })

  it('supports variant suffix format and strips it back to the base workflow', () => {
    const materialized = runtimeWorkflowOverrideName('minimal', 'a1b2c3d4')
    expect(materialized).toBe('minimal__modified-rt-a1b2c3d4')
    expect(stripRuntimeWorkflowOverrideSuffix(materialized)).toBe('minimal')
  })

  it('does not strip names that merely contain the modified marker', () => {
    expect(stripRuntimeWorkflowOverrideSuffix('minimal__modified-preview')).toBe(
      'minimal__modified-preview',
    )
    expect(stripRuntimeWorkflowOverrideSuffix('minimal__modified-a1b2c3d4')).toBe(
      'minimal__modified-a1b2c3d4',
    )
  })

  it('rejects non-hex variant suffix values', () => {
    expect(() => runtimeWorkflowOverrideName('minimal', 'zzzzzzzz')).toThrow(
      /variant must be 8 lowercase hex/i,
    )
  })

  it('leaves base workflow names unchanged', () => {
    expect(stripRuntimeWorkflowOverrideSuffix('minimal')).toBe('minimal')
  })

  it('detects runtime materialized workflow names', () => {
    expect(isRuntimeMaterializedWorkflowName('default__modified')).toBe(true)
    expect(isRuntimeMaterializedWorkflowName('default__modified-rt-a1b2c3d4')).toBe(true)
    expect(isRuntimeMaterializedWorkflowName('default')).toBe(false)
    expect(isRuntimeMaterializedWorkflowName('default__modified-preview')).toBe(false)
  })
})
