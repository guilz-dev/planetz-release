import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRAFT_MINIMAL_YAML,
  LEGACY_WORKFLOW_CALL_YAML,
} from '../../shared/workflow-form/__tests__/workflow-form-fixtures.js'
import { extractWorkflowStructureFeatures } from '../session/workflow-auto/workflow-feature-extractor.js'
import type { WorkflowYamlResolver } from '../session/workflow-auto/workflow-yaml-resolver.js'
import {
  DEFAULT_WRAPPER_YAML,
  IMPLEMENT_HEAVY_YAML,
  INVESTIGATE_ONLY_YAML,
  MIXED_COMPLETION_PATHS_YAML,
} from './workflow-auto-test-fixtures.js'

const resolver: WorkflowYamlResolver = async (name) => {
  const yamlByName: Record<string, string> = {
    'investigate-only': INVESTIGATE_ONLY_YAML,
    'implement-heavy': IMPLEMENT_HEAVY_YAML,
    default: DEFAULT_WRAPPER_YAML,
    'default-draft-minimal': DEFAULT_DRAFT_MINIMAL_YAML,
    draft: DEFAULT_DRAFT_MINIMAL_YAML,
    'legacy-wfc': LEGACY_WORKFLOW_CALL_YAML,
    'mixed-paths': MIXED_COMPLETION_PATHS_YAML,
  }
  const yaml = yamlByName[name]
  return yaml ? { yaml, source: 'builtin' } : null
}

describe('extractWorkflowStructureFeatures', () => {
  it('detects read-only completion path', async () => {
    const features = await extractWorkflowStructureFeatures('investigate-only', resolver)
    expect(features).not.toBeNull()
    expect(features?.canCompleteBeforeFirstEdit).toBe(true)
    expect(features?.canCompleteWithoutEditing).toBe(true)
    expect(features?.forcesImplementationOnAllPaths).toBe(false)
    expect(features?.changeMode).toBe('read_only')
  })

  it('detects implementation-heavy workflow', async () => {
    const features = await extractWorkflowStructureFeatures('implement-heavy', resolver)
    expect(features?.hasImplementationPath).toBe(true)
    expect(features?.forcesImplementationOnAllPaths).toBe(true)
    expect(features?.canCompleteBeforeFirstEdit).toBe(false)
    expect(features?.canCompleteWithoutEditing).toBe(false)
    expect(features?.changeMode).toBe('edit_heavy')
  })

  it('separates canCompleteBeforeFirstEdit from canCompleteWithoutEditing on mixed paths', async () => {
    const features = await extractWorkflowStructureFeatures('mixed-paths', resolver)
    expect(features?.canCompleteBeforeFirstEdit).toBe(true)
    expect(features?.canCompleteWithoutEditing).toBe(false)
    expect(features?.forcesImplementationOnAllPaths).toBe(false)
    expect(features?.hasImplementationPath).toBe(true)
  })

  it('expands workflow_call and inherits subworkflow traits', async () => {
    const features = await extractWorkflowStructureFeatures('legacy-wfc', resolver)
    expect(features?.hasWorkflowCall).toBe(true)
    expect(features?.hasImplementationPath).toBe(true)
  })

  it('treats legacy markdown output_contracts as report outputs', async () => {
    const yaml = `name: legacy-markdown-report
initial_step: plan
steps:
  - name: plan
    persona: planner
    output_contracts:
      markdown:
        - name: plan.md
          format: plan
    rules:
      - condition: ok
        next: COMPLETE
`
    const resolver: WorkflowYamlResolver = async () => ({ yaml, source: 'builtin' })
    const features = await extractWorkflowStructureFeatures('legacy-markdown-report', resolver)
    expect(features?.primaryOutputs).toContain('report')
  })

  it('merges default wrapper with draft subworkflow call', async () => {
    const features = await extractWorkflowStructureFeatures('default', resolver)
    expect(features?.hasWorkflowCall).toBe(true)
    expect(features?.hasImplementationPath).toBe(true)
    expect(features?.forcesImplementationOnAllPaths).toBe(false)
    expect(features?.canCompleteBeforeFirstEdit).toBe(true)
    expect(features?.canCompleteWithoutEditing).toBe(false)
  })
})
