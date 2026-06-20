import { describe, expect, it } from 'vitest'
import {
  evaluateComposerExecutionHint,
  extractWorkflowStepProviders,
  findStepProviderConflicts,
} from '../composer-execution-hint.js'

describe('extractWorkflowStepProviders', () => {
  it('collects step-level providers including nested parallel steps', () => {
    const yaml = `
steps:
  - name: implement
    provider: cursor
  - name: parallel_block
    parallel:
      - name: review
        provider: claude-sdk
`
    expect(extractWorkflowStepProviders(yaml)).toEqual([
      { stepName: 'implement', provider: 'cursor' },
      { stepName: 'review', provider: 'claude-sdk' },
    ])
  })

  it('skips workflow_call steps', () => {
    const yaml = `
steps:
  - name: call_sub
    kind: workflow_call
    call: other
    provider: cursor
`
    expect(extractWorkflowStepProviders(yaml)).toEqual([])
  })
})

describe('findStepProviderConflicts', () => {
  it('returns steps whose provider differs from task override', () => {
    const conflicts = findStepProviderConflicts('ollama', [
      { stepName: 'a', provider: 'cursor' },
      { stepName: 'b', provider: 'ollama' },
    ])
    expect(conflicts).toEqual([{ stepName: 'a', stepProvider: 'cursor' }])
  })
})

describe('evaluateComposerExecutionHint', () => {
  it('returns null when no step pins a different provider', () => {
    const yaml = `steps:\n  - name: chat\n    provider: ollama`
    expect(evaluateComposerExecutionHint({ taskProvider: 'ollama', workflowYaml: yaml })).toBeNull()
  })

  it('detects ollama task override vs cursor step', () => {
    const yaml = `steps:\n  - name: implement\n    provider: cursor\n    edit: true`
    const hint = evaluateComposerExecutionHint({ taskProvider: 'ollama', workflowYaml: yaml })
    expect(hint).toEqual({
      taskProvider: 'ollama',
      conflicts: [{ stepName: 'implement', stepProvider: 'cursor' }],
      effectiveStepProviders: ['cursor'],
    })
  })
})
