import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import {
  collectFacetKeyOptions,
  getStepFacetRefReadOnly,
  getStepInstructionReadOnly,
  isInstructionFacetKey,
  listStepNamesForFacetRef,
  parseOutputContracts,
  serializeOutputContracts,
  setStepFacetRef,
} from '../workflow-facet-utils.js'
import { buildFacetTreeItems } from '../workflow-facets-build-items.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

describe('workflow-facet-utils', () => {
  const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)

  it('lists step names for policy coding', () => {
    expect(listStepNamesForFacetRef(draft, 'policies', 'coding')).toEqual([
      'plan',
      'answer',
      'implement',
      'review',
    ])
  })

  it('lists step names for bare persona refs', () => {
    expect(listStepNamesForFacetRef(draft, 'personas', 'planner')).toEqual(['plan', 'answer'])
    expect(listStepNamesForFacetRef(draft, 'personas', 'coder')).toEqual(['implement'])
  })

  it('setStepFacetRef updates policy on raw', () => {
    const step = draft.steps[0]
    const next = setStepFacetRef(step, 'policies', 'review')
    expect((next.raw as Record<string, unknown>).policy).toBe('review')
    const cleared = setStepFacetRef(next, 'policies', undefined)
    expect((cleared.raw as Record<string, unknown>).policy).toBeUndefined()
  })

  it('isInstructionFacetKey when key is in workflow map', () => {
    const keys = draft.instructions.map((m) => m.key)
    expect(isInstructionFacetKey('plan', keys)).toBe(true)
    expect(isInstructionFacetKey('Do the thing\nwith lines', keys)).toBe(false)
    expect(isInstructionFacetKey('unknown', keys)).toBe(false)
  })

  it('parse and serialize output_contracts', () => {
    const raw = draft.steps[0].raw as Record<string, unknown>
    const rows = parseOutputContracts(raw)
    expect(rows).toEqual([{ group: 'report', format: 'plan', name: 'plan.md' }])
    const serialized = serializeOutputContracts(rows)
    expect(serialized).toEqual({ report: [{ format: 'plan', name: 'plan.md' }] })
  })

  it('collectFacetKeyOptions merges map, step refs, and builtin', () => {
    const opts = collectFacetKeyOptions(draft, 'personas', ['planner', 'extra-persona'])
    const keys = opts.map((o) => o.key)
    expect(keys).toContain('planner')
    expect(keys).toContain('coder')
    expect(keys).toContain('qa-reviewer')
    expect(keys).toContain('extra-persona')
  })

  it('getStepInstructionReadOnly when instruction is a $param object', () => {
    const step = {
      ...draft.steps[0],
      instruction: undefined,
      raw: {
        ...(draft.steps[0].raw as Record<string, unknown>),
        instruction: { $param: 'impl_instruction' },
      },
    }
    expect(getStepInstructionReadOnly(step)).toEqual({
      readOnly: true,
      reason: 'Non-string instructions ($param, etc.) must be edited in YAML.',
    })
  })

  it('getStepFacetRefReadOnly when policy is an array', () => {
    const step = {
      ...draft.steps[0],
      raw: { ...(draft.steps[0].raw as Record<string, unknown>), policy: ['a', 'b'] },
    }
    expect(getStepFacetRefReadOnly(step, 'policies')).toEqual({
      readOnly: true,
      reason: 'Array references must be edited in YAML.',
    })
    expect(getStepFacetRefReadOnly(step, 'personas')).toEqual({ readOnly: false })
  })
})

describe('buildFacetTreeItems', () => {
  it('lists bundled workflow persona map entries without showBuiltin', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const personas = buildFacetTreeItems(draft, 'personas', [], false)
    expect(personas).toHaveLength(3)
    expect(personas.map((p) => p.key).sort()).toEqual(['coder', 'planner', 'qa-reviewer'])
    for (const p of personas) {
      expect(p.listingSource).toBe('workflowMap')
      expect(p.stepReferences).toBe(p.key === 'planner' ? 2 : 1)
    }
  })

  it('shows workflow map entries as workflowMap', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const policies = buildFacetTreeItems(draft, 'policies', [], false)
    expect(policies).toHaveLength(1)
    expect(policies[0].listingSource).toBe('workflowMap')
    expect(policies[0].stepReferences).toBe(4)
  })

  it('adds bundled catalog entries when showBuiltin is on', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const personas = buildFacetTreeItems(draft, 'personas', ['unused-persona'], true)
    expect(
      personas.some((p) => p.key === 'unused-persona' && p.listingSource === 'bundledCatalog'),
    ).toBe(true)
  })
})
