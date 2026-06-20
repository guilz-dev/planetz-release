import { describe, expect, it } from 'vitest'
import { scanWorkflowOllamaCompatibility } from '../ollama-workflow-compat.js'

const OLLAMA_CHAT_WORKFLOW_YAML = `name: ollama-chat
steps:
  - name: chat
    persona: coder
    edit: false
`

describe('scanWorkflowOllamaCompatibility', () => {
  it('flags top-level edit steps', () => {
    const yaml = `name: test
steps:
  - name: implement
    edit: true
`
    const result = scanWorkflowOllamaCompatibility(yaml)
    expect(result.compatible).toBe(false)
    expect(result.issues).toContainEqual({ stepName: 'implement', kind: 'edit' })
  })

  it('recurses into parallel sub-steps', () => {
    const yaml = `name: parallel-wf
steps:
  - name: review
    parallel:
      - name: a
        edit: true
`
    const result = scanWorkflowOllamaCompatibility(yaml)
    expect(result.compatible).toBe(false)
    expect(result.issues).toContainEqual({ stepName: 'a', kind: 'edit' })
  })

  it('treats invalid yaml as incompatible', () => {
    const result = scanWorkflowOllamaCompatibility('steps: [')
    expect(result.compatible).toBe(false)
    expect(result.issues[0]?.kind).toBe('workflow_parse_error')
  })

  it('allows readonly steps with output_contracts only', () => {
    const yaml = `name: plan-only
steps:
  - name: plan
    edit: false
    output_contracts:
      markdown:
        - format: plan
`
    expect(scanWorkflowOllamaCompatibility(yaml).compatible).toBe(true)
  })

  it('treats ollama-chat style workflow as compatible', () => {
    expect(scanWorkflowOllamaCompatibility(OLLAMA_CHAT_WORKFLOW_YAML).compatible).toBe(true)
  })

  it('skips workflow_call steps', () => {
    const yaml = `name: call-wf
steps:
  - name: invoke
    kind: workflow_call
    call: other
    edit: true
`
    const result = scanWorkflowOllamaCompatibility(yaml)
    expect(result.compatible).toBe(true)
  })
})
