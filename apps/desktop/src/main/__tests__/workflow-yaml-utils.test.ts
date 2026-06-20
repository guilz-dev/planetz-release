import { describe, expect, it } from 'vitest'
import { extractWorkflowSteps } from '../lib/workflow-yaml-utils.js'

const SAMPLE = `name: default
steps:
  - name: plan
    persona: planner
  - name: implement
    persona: coder
`

describe('extractWorkflowSteps', () => {
  it('extracts step names and personas from workflow yaml', () => {
    expect(extractWorkflowSteps(SAMPLE)).toEqual([
      { name: 'plan', persona: 'planner' },
      { name: 'implement', persona: 'coder' },
    ])
  })

  it('returns empty array when steps block is missing', () => {
    expect(extractWorkflowSteps('name: minimal\n')).toEqual([])
  })

  it('counts only top-level steps, not nested parallel or report names', () => {
    const yaml = `name: backend
steps:
  - name: plan
    persona: planner
    output_contracts:
      report:
        - name: plan.md
          format: plan
  - name: reviewers_1
    parallel:
      - name: arch-review
        persona: architecture-reviewer
        output_contracts:
          report:
            - name: architect-review.md
              format: architect-review
      - name: testing-review
        persona: testing-reviewer
  - name: fix
    persona: coder
`
    expect(extractWorkflowSteps(yaml)).toEqual([
      { name: 'plan', persona: 'planner' },
      { name: 'reviewers_1' },
      { name: 'fix', persona: 'coder' },
    ])
  })
})
