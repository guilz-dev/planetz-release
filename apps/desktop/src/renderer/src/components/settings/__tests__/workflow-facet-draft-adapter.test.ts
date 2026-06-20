import { describe, expect, it } from 'vitest'
import { BUILTIN_DEFAULT_WORKFLOW_YAML } from '../../../../../main/takt/builtin-workflow-yaml.js'
import {
  collectDraftFacetContentByPath,
  collectFacetManagedPaths,
  facetContentFingerprint,
  hydrateWorkflowDraftFacets,
} from '../workflow-facet-draft-adapter.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

describe('collectFacetManagedPaths', () => {
  it('includes section maps and step-only builtin refs', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    draft.personas.push({ key: 'custom', path: '../facets/personas/custom.md', content: '' })
    const paths = collectFacetManagedPaths(draft)
    expect(paths).toContain('../facets/personas/custom.md')
    expect(paths).toContain('../facets/personas/planner.md')
    expect(paths).toContain('../facets/personas/coder.md')
  })
})

describe('hydrateWorkflowDraftFacets', () => {
  it('fills project section content and facetContentByPath', () => {
    const draft = parseWorkflowYaml(`name: wf
personas:
  planner: ../facets/personas/planner.md
steps:
  - name: plan
    persona: planner
`)
    const hydrated = hydrateWorkflowDraftFacets(draft, [
      {
        managedPath: '../facets/personas/planner.md',
        content: '# Planner body\n',
      },
    ])
    expect(hydrated.personas[0].content).toBe('# Planner body\n')
    expect(hydrated.facetContentByPath?.['../facets/personas/planner.md']).toBe('# Planner body\n')
  })

  it('can overwrite existing content when requested', () => {
    const draft = parseWorkflowYaml(`name: wf
personas:
  planner: ../facets/personas/planner.md
steps:
  - name: plan
    persona: planner
`)
    draft.personas[0].content = '# Local edit\n'
    const hydrated = hydrateWorkflowDraftFacets(
      draft,
      [{ managedPath: '../facets/personas/planner.md', content: '# Snapshot\n' }],
      { overwriteExisting: true },
    )
    expect(hydrated.personas[0].content).toBe('# Snapshot\n')
  })
})

describe('facetContentFingerprint', () => {
  it('changes when facet body changes', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    const before = facetContentFingerprint(draft)
    draft.personas = [{ key: 'x', path: '', content: 'edited' }]
    const after = facetContentFingerprint(draft)
    expect(after).not.toBe(before)
  })
})

describe('collectDraftFacetContentByPath', () => {
  it('extracts project facet content using managed paths', () => {
    const draft = parseWorkflowYaml(BUILTIN_DEFAULT_WORKFLOW_YAML)
    draft.personas = [{ key: 'planner', path: '', content: '# Planner local draft\n' }]
    expect(collectDraftFacetContentByPath(draft)).toEqual({
      '../facets/personas/planner.md': '# Planner local draft\n',
    })
  })
})
