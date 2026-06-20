import { describe, expect, it } from 'vitest'
import { extractWorkflowExecutionDefaults } from '../workflow-execution-defaults.js'

describe('extractWorkflowExecutionDefaults', () => {
  it('reads workflow_config.provider and model', () => {
    const yaml = `name: wf
workflow_config:
  provider: anthropic
  model: claude-wf
steps: []
`
    expect(extractWorkflowExecutionDefaults(yaml)).toEqual({
      provider: 'anthropic',
      model: 'claude-wf',
    })
  })

  it('reads top-level provider and model', () => {
    const yaml = `name: wf
provider: top-provider
model: top-model
steps: []
`
    expect(extractWorkflowExecutionDefaults(yaml)).toEqual({
      provider: 'top-provider',
      model: 'top-model',
    })
  })

  it('does not treat step-level provider/model as workflow defaults', () => {
    const yaml = `name: wf
workflow_config:
  provider: anthropic
steps:
  - name: implement
    provider: step-provider
    model: step-model
`
    expect(extractWorkflowExecutionDefaults(yaml)).toEqual({
      provider: 'anthropic',
    })
  })

  it('prefers top-level provider over workflow_config', () => {
    const yaml = `name: wf
provider: top-level
workflow_config:
  provider: nested
steps: []
`
    expect(extractWorkflowExecutionDefaults(yaml).provider).toBe('top-level')
  })
})
