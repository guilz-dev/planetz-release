import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAT_INVESTIGATION_WORKFLOW_NAME, SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkflowRoutingCatalogStore } from '../planetz/workflow-routing-catalog.js'
import {
  mergeNewWorkflowsIntoRoutingCatalog,
  reconcileBuiltinAutoEligibilityInCatalog,
  reconcileRoutingGroupsInCatalog,
  reconcileRoutingMetadataInCatalog,
} from '../planetz/workflow-routing-catalog-merge.js'

describe('mergeNewWorkflowsIntoRoutingCatalog', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('appends only new workflow names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-merge-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general'],
      workflows: [
        {
          name: 'existing',
          enabledForAuto: true,
          routingGroups: ['feature'],
        },
      ],
    })

    const changed = await mergeNewWorkflowsIntoRoutingCatalog(store, ['existing', 'new-one'])
    expect(changed).toBe(true)

    const text = await readFile(store.routingFilePath(), 'utf8')
    expect(text).toContain('name: existing')
    expect(text).toContain('name: new-one')
    expect(text).toContain('routingGroups')

    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'new-one')?.enabledForAuto).toBe(false)
  })

  it('marks chat-investigation as auto-disabled on append', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-merge-chat-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general'],
      workflows: [],
    })

    const changed = await mergeNewWorkflowsIntoRoutingCatalog(store, [
      CHAT_INVESTIGATION_WORKFLOW_NAME,
    ])
    expect(changed).toBe(true)

    const catalog = await store.load()
    expect(
      catalog.workflows.find((entry) => entry.name === CHAT_INVESTIGATION_WORKFLOW_NAME),
    ).toMatchObject({
      enabledForAuto: false,
    })
  })

  it('assigns ops routing group to terraform on merge', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-merge-terraform-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({ version: 1, groups: ['ops', 'general'], workflows: [] })

    await mergeNewWorkflowsIntoRoutingCatalog(store, [{ name: 'terraform' }])

    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'terraform')?.routingGroups).toEqual([
      'ops',
    ])
  })

  it('assigns feature group and high complexity to spec-driven on merge', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-merge-spec-driven-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({ version: 1, groups: ['feature', 'general'], workflows: [] })

    await mergeNewWorkflowsIntoRoutingCatalog(store, [
      { name: SPEC_DRIVEN_WORKFLOW_NAME, source: 'builtin' },
    ])

    const catalog = await store.load()
    expect(
      catalog.workflows.find((entry) => entry.name === SPEC_DRIVEN_WORKFLOW_NAME),
    ).toMatchObject({
      enabledForAuto: true,
      routingGroups: ['feature'],
      complexityBand: 'high',
      safetyTier: 'safe',
    })
  })

  it('reconciles spec-driven metadata onto legacy catalog rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-reconcile-metadata-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['feature', 'general'],
      workflows: [
        {
          name: SPEC_DRIVEN_WORKFLOW_NAME,
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    })

    const changed = await reconcileRoutingMetadataInCatalog(store)
    expect(changed).toBe(true)

    const catalog = await store.load()
    expect(
      catalog.workflows.find((entry) => entry.name === SPEC_DRIVEN_WORKFLOW_NAME),
    ).toMatchObject({
      routingGroups: ['feature'],
      complexityBand: 'high',
      safetyTier: 'safe',
    })
  })

  it('reconciles general-only terraform entry to ops on workspace open', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-reconcile-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['ops', 'general'],
      workflows: [
        { name: 'terraform', enabledForAuto: true, routingGroups: ['general'] },
        { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
      ],
    })

    const changed = await reconcileRoutingGroupsInCatalog(store, [{ name: 'terraform' }])
    expect(changed).toBe(true)

    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'terraform')?.routingGroups).toEqual([
      'ops',
    ])
    expect(catalog.workflows.find((entry) => entry.name === 'default')?.routingGroups).toEqual([
      'general',
    ])
  })
})

describe('reconcileBuiltinAutoEligibilityInCatalog', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('downgrades library builtin auto and keeps manually true out of reconcile restore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-auto-reconcile-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general', 'ops'],
      workflows: [
        { name: 'terraform', enabledForAuto: true, routingGroups: ['ops'] },
        { name: 'default', enabledForAuto: false, routingGroups: ['general'] },
      ],
    })

    const changed = await reconcileBuiltinAutoEligibilityInCatalog(store, [
      { name: 'terraform', source: 'builtin' },
      { name: 'default', source: 'builtin' },
    ])
    expect(changed).toBe(true)

    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'terraform')?.enabledForAuto).toBe(
      false,
    )
    expect(catalog.workflows.find((entry) => entry.name === 'default')?.enabledForAuto).toBe(true)
  })
})
