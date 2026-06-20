import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { SPEC_DRIVEN_INSTALLER_SENTINEL } from '../spec-driven-installer-version.js'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../spec-driven-workflow-yaml.js'

function stepBlock(stepName: string): string {
  const marker = `\n  - name: ${stepName}\n`
  const start = SPEC_DRIVEN_WORKFLOW_YAML.indexOf(marker)
  if (start < 0) return ''
  const rest = SPEC_DRIVEN_WORKFLOW_YAML.slice(start + marker.length)
  const end = rest.search(/\n {2}- name: /)
  return end < 0 ? rest : rest.slice(0, end)
}

function stepRules(stepName: string): Array<{ condition: string; next: string }> {
  const block = stepBlock(stepName)
  if (!block) return []
  const rules: Array<{ condition: string; next: string }> = []
  const lines = block.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const condition = lines[i]?.match(/^\s+- condition:\s*(.+)$/)?.[1]
    if (!condition) continue
    const nextLine = lines[i + 1]
    const next = nextLine?.match(/^\s+next:\s*(\S+)/)?.[1]
    if (next) rules.push({ condition, next })
  }
  return rules
}

describe('SPEC_DRIVEN_WORKFLOW_YAML transition scenarios', () => {
  it('declares spec-driven workflow name and report output contracts', () => {
    expect(SPEC_DRIVEN_WORKFLOW_YAML.startsWith(SPEC_DRIVEN_INSTALLER_SENTINEL)).toBe(true)
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain(`name: ${SPEC_DRIVEN_WORKFLOW_NAME}`)
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain('output_contracts:')
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain('report:')
    expect(SPEC_DRIVEN_WORKFLOW_YAML).not.toContain('markdown:')
  })

  it('S1: implement steps emit coder-scope, coder-decisions, and decisions.json', () => {
    for (const stepName of ['implement_core', 'implement_ui'] as const) {
      const block = stepBlock(stepName)
      expect(block).toContain('coder-scope.md')
      expect(block).toContain('coder-decisions.md')
      expect(block).toContain('decisions.json')
      expect(block).toContain('format: decisions_json')
    }
  })

  it('R3: observe step is read-only and sits between implement and review', () => {
    const observeBlock = stepBlock('observe')
    expect(observeBlock).toContain('edit: false')
    expect(observeBlock).toContain('spec-observer')
    expect(observeBlock).toContain('observe-implementation')
    expect(observeBlock).toContain('observation.json')
    expect(observeBlock).toContain('format: observation_json')

    const coreRules = stepRules('implement_core')
    expect(coreRules).toContainEqual({
      condition: 'Core tasks complete and there are no UI tasks',
      next: 'observe',
    })
    const uiRules = stepRules('implement_ui')
    expect(uiRules).toContainEqual({
      condition: 'UI tasks complete',
      next: 'observe',
    })
    const observeRules = stepRules('observe')
    expect(observeRules).toContainEqual({
      condition: 'Observation complete',
      next: 'review',
    })
  })

  it('R7: review blocks COMPLETE when observation STATUS is NO-GO', () => {
    const reviewRules = stepRules('review')
    expect(reviewRules[0]).toEqual({
      condition: 'Observation status is NO-GO',
      next: 'implement_core',
    })
    expect(reviewRules).toContainEqual({
      condition: 'Approved',
      next: 'COMPLETE',
    })
  })

  it('S5: implement steps include established-decisions knowledge facet', () => {
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain(
      'established-decisions: ../facets/knowledge/established-decisions.md',
    )
    for (const stepName of ['implement_core', 'implement_ui'] as const) {
      const block = stepBlock(stepName)
      expect(block).toContain('established-decisions')
    }
  })

  it('F1: analyze_requirements supplies decided-intent-context and emits intent-links.json', () => {
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain(
      'decided-intent-context: ../facets/knowledge/decided-intent-context.md',
    )
    const analyzeBlock = stepBlock('analyze_requirements')
    expect(analyzeBlock).toContain('decided-intent-context')
    expect(analyzeBlock).toContain('intent-links.json')
    expect(analyzeBlock).toContain('format: intent_links_json')
    expect(analyzeBlock).toContain('requirements.md')
  })

  it('S2: review step applies review and spec-fidelity policies', () => {
    const reviewBlock = stepBlock('review')
    expect(reviewBlock).toContain('policy:')
    expect(reviewBlock).toContain('review')
    expect(reviewBlock).toContain('spec-fidelity')
    expect(SPEC_DRIVEN_WORKFLOW_YAML).toContain(
      'spec-fidelity: ../facets/policies/spec-fidelity.md',
    )
  })

  it('scenario: UI required — design routes to ui_design then plan', () => {
    const designRules = stepRules('design')
    expect(designRules).toContainEqual({
      condition: 'Design complete and UI design is required',
      next: 'ui_design',
    })

    const uiRules = stepRules('ui_design')
    expect(uiRules).toContainEqual({
      condition: 'UI design complete',
      next: 'plan',
    })
  })

  it('scenario: no UI — design skips ui_design to plan', () => {
    const designRules = stepRules('design')
    expect(designRules).toContainEqual({
      condition: 'Design complete and no UI design is needed',
      next: 'plan',
    })
  })

  it('scenario: ambiguous requirements — interactive clarification loop on analyze_requirements', () => {
    const analyzeBlock = stepBlock('analyze_requirements')
    expect(analyzeBlock).toContain('requires_user_input: true')
    expect(analyzeBlock).toContain('interactive_only: true')

    const analyzeRules = stepRules('analyze_requirements')
    expect(analyzeRules).toContainEqual({
      condition: 'Clarification needed from the user',
      next: 'analyze_requirements',
    })
  })
})
