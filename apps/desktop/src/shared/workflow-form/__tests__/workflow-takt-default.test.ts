import { describe, expect, it } from 'vitest'
import { hasRoundTripLoss, isFormSafe } from '../workflow-form-safety.js'
import { parseWorkflowYaml } from '../workflow-parse.js'
import {
  readonlyReasonForDraft,
  workflowFormBanner,
  workflowFormMode,
} from '../workflow-readonly.js'
import { serializeWorkflowDraft } from '../workflow-serialize.js'
import {
  BUILTIN_DEFAULT_MINIMAL_YAML,
  LEGACY_WORKFLOW_CALL_YAML,
  TAKT_DEFAULT_MINIMAL_YAML,
  TAKT_REFRESH_FAST_MINIMAL_YAML,
} from './workflow-form-fixtures.js'

describe('takt-default form mode fixtures', () => {
  it('parses takt-default-minimal without unsupported keys', () => {
    const draft = parseWorkflowYaml(TAKT_DEFAULT_MINIMAL_YAML)
    expect(draft.unsupportedKeys).toEqual([])
    expect(draft.steps.find((s) => s.name === 'draft')?.special).toBe('workflow_call')
  })

  it('round-trips takt-default-minimal without loss', () => {
    expect(hasRoundTripLoss(TAKT_DEFAULT_MINIMAL_YAML)).toBe(false)
  })

  it('is partial form mode for takt-default-minimal', () => {
    const draft = parseWorkflowYaml(TAKT_DEFAULT_MINIMAL_YAML)
    expect(workflowFormMode(draft, TAKT_DEFAULT_MINIMAL_YAML)).toBe('partial')
    expect(readonlyReasonForDraft(draft, TAKT_DEFAULT_MINIMAL_YAML)).toBeNull()
    expect(workflowFormBanner(draft)).toContain('workflow_call')
  })

  it('preserves rule extras and provider_options on serialize', () => {
    const draft = parseWorkflowYaml(TAKT_DEFAULT_MINIMAL_YAML)
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('provider_options:')
    expect(out).toContain('requires_user_input: true')
    expect(out).toContain('interactive_only: true')
    expect(out).toContain('use_judge: false')
    expect(out).toContain('kind: workflow_call')
    expect(out).toContain('call: draft')
  })

  it('parses refresh-fast minimal with session passthrough', () => {
    const draft = parseWorkflowYaml(TAKT_REFRESH_FAST_MINIMAL_YAML)
    expect(draft.unsupportedKeys).toEqual([])
    expect(workflowFormMode(draft, TAKT_REFRESH_FAST_MINIMAL_YAML)).toBe('partial')
    const out = serializeWorkflowDraft(draft)
    expect(out).toContain('session: refresh')
  })

  it('keeps default workflow as full form', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_MINIMAL_YAML)
    expect(workflowFormMode(draft, BUILTIN_DEFAULT_MINIMAL_YAML)).toBe('full')
    expect(isFormSafe(draft)).toBe(true)
    expect(hasRoundTripLoss(BUILTIN_DEFAULT_MINIMAL_YAML)).toBe(false)
  })

  it('treats legacy call-only steps as workflow_call (partial)', () => {
    const draft = parseWorkflowYaml(LEGACY_WORKFLOW_CALL_YAML)
    expect(draft.unsupportedKeys).toEqual([])
    expect(draft.steps[0]?.special).toBe('workflow_call')
    expect(workflowFormMode(draft, LEGACY_WORKFLOW_CALL_YAML)).toBe('partial')
    expect(hasRoundTripLoss(LEGACY_WORKFLOW_CALL_YAML)).toBe(false)
  })
})

describe('readonlyReasonForDraft', () => {
  it('returns null for parallel-only workflow in partial mode', () => {
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
    expect(workflowFormMode(draft)).toBe('full')
  })

  it('returns unsupported keys message for unknown step keys', () => {
    const draft = parseWorkflowYaml(`name: wf
steps:
  - name: plan
    unknown_future_key: true
`)
    expect(readonlyReasonForDraft(draft)).toContain('Unsupported keys')
    expect(workflowFormMode(draft)).toBe('yaml-only')
  })
})
