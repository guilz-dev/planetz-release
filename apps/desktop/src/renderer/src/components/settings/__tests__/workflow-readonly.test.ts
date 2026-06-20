import { describe, expect, it } from 'vitest'
import { parseWorkflowYaml } from '../workflow-parse.js'
import { readonlyReasonForDraft, workflowFormMode } from '../workflow-readonly.js'

describe('readonlyReasonForDraft (renderer re-export parity)', () => {
  it('returns null for parallel steps in partial mode', () => {
    const draft = parseWorkflowYaml(`name: wf
steps:
  - name: review
    parallel: []
`)
    expect(readonlyReasonForDraft(draft, '')).toBeNull()
    expect(workflowFormMode(draft)).toBe('partial')
  })

  it('returns null for form-safe default workflow', () => {
    const draft = parseWorkflowYaml(`name: default
steps:
  - name: plan
    persona: planner
`)
    expect(readonlyReasonForDraft(draft)).toBeNull()
  })
})
