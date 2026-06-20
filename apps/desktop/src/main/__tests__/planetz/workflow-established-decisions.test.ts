import { describe, expect, it } from 'vitest'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../../shared/spec-driven/spec-driven-workflow-yaml.js'
import { workflowReferencesEstablishedDecisions } from '../../planetz/workflow-established-decisions.js'

describe('workflowReferencesEstablishedDecisions', () => {
  it('detects facet map and step knowledge references', () => {
    expect(workflowReferencesEstablishedDecisions(SPEC_DRIVEN_WORKFLOW_YAML)).toBe(true)
    expect(
      workflowReferencesEstablishedDecisions(`
steps:
  - name: implement
    knowledge:
      - established-decisions
`),
    ).toBe(true)
  })

  it('returns false when workflow does not reference the facet', () => {
    expect(
      workflowReferencesEstablishedDecisions(`
name: minimal
steps:
  - name: run
    knowledge:
      - architecture
`),
    ).toBe(false)
  })
})
