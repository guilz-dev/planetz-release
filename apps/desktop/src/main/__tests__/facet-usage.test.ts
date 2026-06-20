import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { listFacetUsages } from '../takt/facet-usage.js'

describe('listFacetUsages', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('returns workflow names that reference a facet key in steps', async () => {
    workspace = join(tmpdir(), `planetz-facet-usage-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    await writeFile(
      join(wfDir, 'demo.yaml'),
      `name: demo
steps:
  - name: plan
    persona: planner
`,
      'utf8',
    )

    const usage = await listFacetUsages(workspace, DEFAULT_CONFIG, 'personas', 'planner')
    expect(usage.workflowCount).toBe(1)
    expect(usage.stepCount).toBe(1)
    expect(usage.workflowNames).toEqual(['demo'])
  })

  it('returns empty when no workflows reference the facet', async () => {
    workspace = join(tmpdir(), `planetz-facet-usage-empty-${Date.now()}`)
    const wfDir = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(wfDir, { recursive: true })
    await writeFile(
      join(wfDir, 'other.yaml'),
      `name: other
steps:
  - name: plan
    persona: coder
`,
      'utf8',
    )

    const usage = await listFacetUsages(workspace, DEFAULT_CONFIG, 'personas', 'planner')
    expect(usage.workflowCount).toBe(0)
    expect(usage.stepCount).toBe(0)
    expect(usage.workflowNames).toEqual([])
  })
})
