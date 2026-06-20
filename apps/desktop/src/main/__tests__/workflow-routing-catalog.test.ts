import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkflowRoutingCatalogStore } from '../planetz/workflow-routing-catalog.js'

describe('WorkflowRoutingCatalogStore', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('loads a valid catalog from disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-catalog-valid-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general', 'bugfix'],
      workflows: [
        {
          name: 'default',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    })

    const loaded = await store.load()
    expect(loaded.workflows).toHaveLength(1)
    expect(loaded.workflows[0]?.name).toBe('default')
  })

  it('returns empty catalog when YAML fails schema validation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-catalog-invalid-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    const path = store.routingFilePath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, 'version: not-a-number\nworkflows: []\n', 'utf8')

    const loaded = await store.load()
    expect(loaded.workflows).toEqual([])
    expect(loaded.groups.length).toBeGreaterThan(0)
  })

  it('reuses in-memory cache until the file mtime changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-catalog-mtime-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general'],
      workflows: [
        {
          name: 'alpha',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    })

    const first = await store.load()
    expect(first.workflows[0]?.name).toBe('alpha')

    const path = store.routingFilePath()
    const text = await readFile(path, 'utf8')
    const updated = text.replace('name: alpha', 'name: beta')
    await writeFile(path, updated, 'utf8')
    store.invalidate()

    const second = await store.load()
    expect(second.workflows[0]?.name).toBe('beta')
  })
})
