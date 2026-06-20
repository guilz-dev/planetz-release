import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteProjectFacet,
  ensureCanonicalDirWorkflowFacetsMaterialized,
  facetManagedPathFromKindKey,
  listBuiltinFacetCatalog,
  listProjectFacets,
  managedPathToFacetRel,
  materializeMissingFacetsForWorkflowYaml,
  readFacetAtManagedPath,
  writeProjectFacet,
} from '../takt/facet-resolver.js'

describe('managedPathToFacetRel', () => {
  it('parses standard workflow-managed facet paths', () => {
    expect(managedPathToFacetRel('../facets/personas/planner.md')).toBe('personas/planner.md')
    expect(managedPathToFacetRel('facets/policies/coding.md')).toBe('policies/coding.md')
  })

  it('rejects traversal-like paths', () => {
    expect(managedPathToFacetRel('../facets/personas/../secrets.md')).toBeNull()
    expect(managedPathToFacetRel('../facets/../../etc/passwd.md')).toBeNull()
  })
})

describe('readFacetAtManagedPath', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('reads project facet files under sidecar facets root', async () => {
    workspace = join(tmpdir(), `planetz-facet-${Date.now()}`)
    const facetPath = join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'custom.md')
    await mkdir(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas'), { recursive: true })
    await writeFile(facetPath, '# Custom\n', 'utf8')

    const result = await readFacetAtManagedPath(
      workspace,
      DEFAULT_CONFIG,
      '../facets/personas/custom.md',
    )
    expect(result.source).toBe('project')
    expect(result.content).toBe('# Custom\n')
  })

  it('reads bundled builtin facets when project file is absent', async () => {
    workspace = join(tmpdir(), `planetz-facet-builtin-${Date.now()}`)
    await mkdir(workspace, { recursive: true })

    const result = await readFacetAtManagedPath(
      workspace,
      DEFAULT_CONFIG,
      '../facets/personas/planner.md',
    )
    if (result.source !== 'builtin') {
      expect(result.source).toBe('missing')
      return
    }
    expect(result.content).toMatch(/planner/i)
    expect(result.content?.length).toBeGreaterThan(50)
  })

  it('returns missing for traversal outside workspace', async () => {
    workspace = join(tmpdir(), `planetz-facet-traversal-${Date.now()}`)
    await mkdir(workspace, { recursive: true })

    const result = await readFacetAtManagedPath(workspace, DEFAULT_CONFIG, '../../../etc/passwd.md')
    expect(result.source).toBe('missing')
    expect(result.content).toBeNull()
  })
})

describe('listBuiltinFacetCatalog', () => {
  it('lists builtin facet keys by kind and excludes system files', async () => {
    const catalog = await listBuiltinFacetCatalog()

    expect(catalog.personas).toContain('planner')
    expect(catalog.policies).toContain('coding')
    expect(catalog.knowledge).toContain('architecture')
    expect(catalog.instructions).toContain('plan')
    expect(catalog.reportFormats).toContain('qa-review')

    expect(catalog.instructions).not.toContain('_system')
    expect(catalog.instructions).not.toContain('fallback-notice')
  })

  it('deduplicates keys across bundled languages', async () => {
    const catalog = await listBuiltinFacetCatalog()
    const plannerCount = catalog.personas.filter((key) => key === 'planner').length
    expect(plannerCount).toBe(1)
  })
})

describe('listProjectFacets', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('lists markdown files under sidecar facets root by kind', async () => {
    workspace = join(tmpdir(), `planetz-facet-list-${Date.now()}`)
    await mkdir(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas'), { recursive: true })
    await writeFile(
      join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'alpha.md'),
      '# A\n',
      'utf8',
    )
    const items = await listProjectFacets(workspace, DEFAULT_CONFIG)
    expect(items).toEqual([
      {
        kind: 'personas',
        key: 'alpha',
        managedPath: facetManagedPathFromKindKey('personas', 'alpha'),
      },
    ])
  })
})

describe('ensureCanonicalDirWorkflowFacetsMaterialized', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('materializes facets for every workflow yaml in a directory', async () => {
    workspace = join(tmpdir(), `planetz-facet-canonical-dir-${Date.now()}`)
    const workflowsDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    const facetsRoot = join(workspace, SIDECAR_DIR_NAME, 'facets')
    await mkdir(workflowsDir, { recursive: true })
    await writeFile(
      join(workflowsDir, 'minimal.yaml'),
      `name: minimal
personas:
  coder: ../facets/personas/coder.md
steps:
  - name: run
    persona: coder
`,
      'utf8',
    )

    const result = await ensureCanonicalDirWorkflowFacetsMaterialized(facetsRoot, workflowsDir)
    expect(result.workflowFiles).toBe(1)
    expect(result.facetRefs).toBeGreaterThan(0)
    expect(result.facetsMaterialized).toBeGreaterThan(0)

    const coder = await readFile(join(facetsRoot, 'personas', 'coder.md'), 'utf8')
    expect(coder.length).toBeGreaterThan(10)
  })
})

describe('materializeMissingFacetsForWorkflowYaml', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('copies bundled persona facets referenced by workflow yaml', async () => {
    workspace = join(tmpdir(), `planetz-facet-materialize-${Date.now()}`)
    await mkdir(workspace, { recursive: true })
    const yaml = `name: wf
personas:
  qa-reviewer: ../facets/personas/qa-reviewer.md
steps:
  - name: review
    persona: qa-reviewer
`

    await materializeMissingFacetsForWorkflowYaml(join(workspace, SIDECAR_DIR_NAME, 'facets'), yaml)

    const dest = join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'qa-reviewer.md')
    const content = await readFile(dest, 'utf8')
    expect(content.length).toBeGreaterThan(10)
  })

  it('does not overwrite existing project facet files', async () => {
    workspace = join(tmpdir(), `planetz-facet-materialize-${Date.now()}`)
    const dest = join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'qa-reviewer.md')
    await mkdir(join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas'), { recursive: true })
    await writeFile(dest, '# Custom reviewer\n', 'utf8')

    await materializeMissingFacetsForWorkflowYaml(
      join(workspace, SIDECAR_DIR_NAME, 'facets'),
      'personas:\n  qa-reviewer: ../facets/personas/qa-reviewer.md\nsteps: []\n',
    )

    expect(await readFile(dest, 'utf8')).toBe('# Custom reviewer\n')
  })
})

describe('writeProjectFacet / deleteProjectFacet', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('writes and deletes project facet files', async () => {
    workspace = join(tmpdir(), `planetz-facet-crud-${Date.now()}`)
    await mkdir(workspace, { recursive: true })
    const result = await writeProjectFacet(
      workspace,
      DEFAULT_CONFIG,
      'personas',
      'coder',
      '# Coder\n',
    )
    expect(result.path).toBe(`${SIDECAR_DIR_NAME}/facets/personas/coder.md`)
    const read = await readFacetAtManagedPath(
      workspace,
      DEFAULT_CONFIG,
      facetManagedPathFromKindKey('personas', 'coder'),
    )
    expect(read.source).toBe('project')
    expect(read.content).toBe('# Coder\n')
    await deleteProjectFacet(workspace, DEFAULT_CONFIG, 'personas', 'coder')
    const missing = await readFacetAtManagedPath(
      workspace,
      DEFAULT_CONFIG,
      facetManagedPathFromKindKey('personas', 'coder'),
    )
    expect(missing.source).not.toBe('project')
  })
})
