import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import {
  findDanglingRefs,
  isReservedStepName,
  renameStepInDraft,
  routeDiagnosticsToSteps,
} from '../workflow-diagnostics.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

describe('renameStepInDraft', () => {
  it('updates rules.next and initial_step references', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const renamed = renameStepInDraft(draft, 'implement', 'build')
    expect(renamed.steps.find((s) => s.name === 'build')).toBeDefined()
    expect(renamed.initialStep).toBe('plan')
    const plan = renamed.steps.find((s) => s.name === 'plan')
    expect(plan?.rules.some((r) => r.next === 'build')).toBe(true)
  })
})

describe('findDanglingRefs', () => {
  it('detects missing next targets', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    draft.steps[0].rules.push({
      id: 'x',
      mode: 'tag',
      text: 'missing',
      next: 'no-such-step',
    })
    const dangling = findDanglingRefs(draft)
    expect(dangling.some((d) => d.next === 'no-such-step')).toBe(true)
  })

  it('does not treat reserved terminal targets as dangling', () => {
    const draft = parseWorkflowYaml(`name: wf
steps:
  - name: plan
    rules:
      - condition: done
        next: COMPLETE
      - condition: stop
        next: abort
`)
    expect(findDanglingRefs(draft)).toEqual([])
  })
})

describe('routeDiagnosticsToSteps', () => {
  it('routes messages that mention a step name', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const routed = routeDiagnosticsToSteps(draft, [
      { level: 'error', message: 'step "implement" is missing persona file' },
      { level: 'warn', message: 'workflow name mismatch' },
    ])
    expect(routed.byStep.get('implement')).toHaveLength(1)
    expect(routed.global).toHaveLength(1)
  })

  it('does not match step names as substrings of other words', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const routed = routeDiagnosticsToSteps(draft, [
      { level: 'error', message: 'explained in detail at planning phase' },
    ])
    expect(routed.byStep.get('plan')).toBeUndefined()
    expect(routed.global).toHaveLength(1)
  })
})

describe('isReservedStepName', () => {
  it('rejects terminal pseudo-steps', () => {
    expect(isReservedStepName('COMPLETE')).toBe(true)
    expect(isReservedStepName('abort')).toBe(true)
    expect(isReservedStepName('plan')).toBe(false)
  })
})
