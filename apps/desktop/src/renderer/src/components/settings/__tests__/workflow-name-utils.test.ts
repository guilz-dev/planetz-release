import type { WorkflowSummary } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { newEmptyScaffoldDraft } from '../workflow-create-utils.js'
import {
  isDuplicateProjectWorkflowName,
  suggestDefaultWorkflowName,
  validateInitialStep,
  validateWorkflowName,
} from '../workflow-name-utils.js'

function project(name: string): WorkflowSummary {
  return {
    name,
    source: 'project',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  }
}

describe('workflow-name-utils', () => {
  it('suggests my-workflow when unused', () => {
    expect(suggestDefaultWorkflowName([])).toBe('my-workflow')
  })

  it('increments suffix when my-workflow exists', () => {
    const workflows = [project('my-workflow')]
    expect(suggestDefaultWorkflowName(workflows)).toBe('my-workflow-2')
    workflows.push(project('my-workflow-2'))
    expect(suggestDefaultWorkflowName(workflows)).toBe('my-workflow-3')
  })

  it('detects duplicate project names', () => {
    const workflows = [project('my-workflow')]
    expect(isDuplicateProjectWorkflowName('my-workflow', workflows)).toBe(true)
    expect(isDuplicateProjectWorkflowName('other', workflows)).toBe(false)
  })

  it('validates kebab-case names', () => {
    expect(validateWorkflowName('')).toMatch(/required/i)
    expect(validateWorkflowName('My_Workflow')).toMatch(/kebab-case/i)
    expect(validateWorkflowName('my-workflow')).toBeNull()
  })

  it('requires initial step on empty scaffold', () => {
    const draft = newEmptyScaffoldDraft('my-flow')
    expect(draft.initialStep).toBeUndefined()
    expect(validateInitialStep(draft)).toMatch(/required/i)
    expect(validateInitialStep({ ...draft, initialStep: 'plan' })).toBeNull()
  })

  it('applies custom max steps on empty scaffold', () => {
    const draft = newEmptyScaffoldDraft('my-flow', 'plan', 15)
    expect(draft.maxSteps).toBe(15)
  })

  it('includes scaffold personas required by default steps', () => {
    const draft = newEmptyScaffoldDraft('my-flow', 'plan')
    expect(draft.personas.map((p) => p.key).sort()).toEqual(['coder', 'planner', 'qa-reviewer'])
  })
})
