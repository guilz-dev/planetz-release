import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMockWithStorage } from '../../../__tests__/orbit-mock.js'
import {
  collectWorkflowFacetFilesForSave,
  loadWorkflowDraftWithFacets,
  parseWorkflowFacetDraftSnapshot,
  persistWorkflowDraft,
  resolveWorkflowDraftOnOpen,
  WORKFLOW_DRAFT_STORAGE_PREFIX,
  workflowDraftFacetStorageKey,
} from '../workflow-draft-persistence.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

const DISK_YAML = `name: test-wf
initial_step: step-1
steps:
  - name: step-1
    rules: []
`

describe('collectWorkflowFacetFilesForSave', () => {
  it('returns undefined when no facet content', () => {
    const parsed = parseWorkflowYaml(DISK_YAML)
    expect(collectWorkflowFacetFilesForSave(parsed)).toBeUndefined()
  })

  it('maps non-empty facets to project-relative paths', () => {
    const parsed = parseWorkflowYaml(`${DISK_YAML}
personas:
  planner: ""
`)
    parsed.personas = [
      { key: 'planner', path: '../facets/personas/planner.md', content: '# Planner' },
    ]
    expect(collectWorkflowFacetFilesForSave(parsed)).toEqual({
      'facets/personas/planner.md': '# Planner\n',
    })
  })
})

describe('parseWorkflowFacetDraftSnapshot', () => {
  it('returns null for invalid JSON', () => {
    expect(parseWorkflowFacetDraftSnapshot('{not json')).toBeNull()
  })

  it('ignores non-string facet values', () => {
    expect(parseWorkflowFacetDraftSnapshot(JSON.stringify({ 'a.md': 1 }))).toBeNull()
  })

  it('parses valid facet snapshot', () => {
    expect(parseWorkflowFacetDraftSnapshot(JSON.stringify({ 'facets/a.md': '# hi' }))).toEqual({
      'facets/a.md': '# hi',
    })
  })
})

describe('persistWorkflowDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves via orbit and removes legacy localStorage key on success', async () => {
    const { orbit, storage } = installOrbitMockWithStorage()
    const draft = parseWorkflowYaml(DISK_YAML)
    storage.setItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}test-wf`, 'legacy')

    await persistWorkflowDraft(draft, DISK_YAML)

    expect(orbit.saveWorkflowDraft).toHaveBeenCalledWith({ name: 'test-wf', yaml: DISK_YAML })
    expect(storage.getItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}test-wf`)).toBeNull()
  })

  it('falls back to localStorage when orbit save fails', async () => {
    const { orbit, storage } = installOrbitMockWithStorage({
      saveWorkflowDraft: vi.fn(async () => {
        throw new Error('workspace closed')
      }),
    })
    const draft = parseWorkflowYaml(DISK_YAML)

    await persistWorkflowDraft(draft, DISK_YAML)

    expect(orbit.saveWorkflowDraft).toHaveBeenCalled()
    expect(storage.getItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}test-wf`)).toBe(DISK_YAML)
  })
})

describe('loadWorkflowDraftWithFacets', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns draft unchanged when facet read fails', async () => {
    installOrbitMockWithStorage({
      readWorkflowFacets: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    const draft = parseWorkflowYaml(`name: facet-wf
initial_step: step-1
steps:
  - name: step-1
    persona: planner
    rules: []
`)

    const result = await loadWorkflowDraftWithFacets(draft)

    expect(result).toBe(draft)
  })

  it('hydrates facet content from orbit reads', async () => {
    installOrbitMockWithStorage({
      readWorkflowFacets: vi.fn(async () => [
        {
          managedPath: '../facets/personas/planner.md',
          source: 'project' as const,
          content: '# Planner persona',
        },
      ]),
    })
    const draft = parseWorkflowYaml(`name: facet-wf
initial_step: step-1
personas:
  planner: ""
steps:
  - name: step-1
    persona: planner
    rules: []
`)

    const result = await loadWorkflowDraftWithFacets(draft)

    const persona = result.personas.find((p) => p.key === 'planner')
    expect(persona?.content).toContain('Planner persona')
  })
})

describe('resolveWorkflowDraftOnOpen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores disk draft yaml when user confirms', async () => {
    const draftYaml = `${DISK_YAML}# draft marker`
    installOrbitMockWithStorage({
      loadWorkflowDraft: vi.fn(async () => ({ yaml: draftYaml })),
    })
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )

    const result = await resolveWorkflowDraftOnOpen('test-wf', DISK_YAML)

    expect(result.restoreDrafts).toBe(true)
    expect(result.yaml).toBe(draftYaml)
  })

  it('clears drafts and keeps disk yaml when user declines restore', async () => {
    const { orbit, storage } = installOrbitMockWithStorage({
      loadWorkflowDraft: vi.fn(async () => ({ yaml: `${DISK_YAML}# draft` })),
    })
    storage.setItem(workflowDraftFacetStorageKey('test-wf'), JSON.stringify({ 'f.md': 'x' }))
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )

    const result = await resolveWorkflowDraftOnOpen('test-wf', DISK_YAML)

    expect(result.restoreDrafts).toBe(false)
    expect(result.yaml).toBe(DISK_YAML)
    expect(orbit.deleteWorkflowDraft).toHaveBeenCalledWith({ name: 'test-wf' })
    expect(storage.getItem(workflowDraftFacetStorageKey('test-wf'))).toBeNull()
  })
})
