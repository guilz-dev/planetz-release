import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import { hasRoundTripLoss } from '../workflow-form-safety.js'

describe('structuralFingerprint / round-trip safety', () => {
  it('preserves advanced keys after round-trip', () => {
    const yaml = `${BUILTIN_DEFAULT_WORKFLOW_YAML}loop_monitors: []\n`
    expect(hasRoundTripLoss(yaml)).toBe(false)
  })

  it('detects loss of unknown top-level keys after round-trip', () => {
    const yaml = `${BUILTIN_DEFAULT_WORKFLOW_YAML}custom_future_key: true\n`
    expect(hasRoundTripLoss(yaml)).toBe(true)
  })
})
