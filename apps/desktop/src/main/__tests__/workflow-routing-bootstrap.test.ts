import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAT_INVESTIGATION_WORKFLOW_NAME, type WorkflowSummary } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureWorkflowRoutingCatalogSeeded } from '../planetz/workflow-routing-bootstrap.js'
import { WorkflowRoutingCatalogStore } from '../planetz/workflow-routing-catalog.js'

describe('ensureWorkflowRoutingCatalogSeeded', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('creates catalog only when file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-bootstrap-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    const workflows = [
      {
        name: 'default',
        description: 'Default',
        source: 'builtin',
        formEditable: true,
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ] satisfies WorkflowSummary[]

    const seeded = await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    expect(seeded).toBe(true)
    await access(store.routingFilePath())

    const seededAgain = await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    expect(seededAgain).toBe(false)
  })

  it('does not overwrite an existing catalog file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-bootstrap-existing-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    await store.write({
      version: 1,
      groups: ['general'],
      workflows: [
        {
          name: 'custom-only',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    })

    const seeded = await ensureWorkflowRoutingCatalogSeeded(store, [
      {
        name: 'default',
        description: 'Default',
        source: 'builtin',
        formEditable: true,
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ] satisfies WorkflowSummary[])
    expect(seeded).toBe(false)

    const text = await readFile(store.routingFilePath(), 'utf8')
    expect(text).toContain('custom-only')
    expect(text).not.toContain('name: default')
  })

  it('seeds chat-investigation as auto-disabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-bootstrap-chat-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    const workflows = [
      {
        name: CHAT_INVESTIGATION_WORKFLOW_NAME,
        description: 'Chat investigation only',
        source: 'builtin',
        formEditable: true,
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ] satisfies WorkflowSummary[]

    const seeded = await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    expect(seeded).toBe(true)
    const catalog = await store.load()
    expect(
      catalog.workflows.find((entry) => entry.name === CHAT_INVESTIGATION_WORKFLOW_NAME),
    ).toMatchObject({
      enabledForAuto: false,
    })
  })

  it('seeds terraform as auto-disabled for library tier', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-bootstrap-terraform-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    const workflows = [
      {
        name: 'terraform',
        description: 'Infra',
        source: 'builtin' as const,
        formEditable: true,
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ] satisfies WorkflowSummary[]

    await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'terraform')).toMatchObject({
      enabledForAuto: false,
    })
  })

  it('seeds project workflows as auto-disabled by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-routing-bootstrap-project-'))
    roots.push(root)
    const store = new WorkflowRoutingCatalogStore(root)
    const workflows = [
      {
        name: 'my-flow',
        description: 'Project flow',
        source: 'project' as const,
        formEditable: true,
        stepNames: [],
        agentRoles: [],
        steps: [],
        isOverridden: false,
        diagnostics: [],
      },
    ] satisfies WorkflowSummary[]

    await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    const catalog = await store.load()
    expect(catalog.workflows.find((entry) => entry.name === 'my-flow')).toMatchObject({
      enabledForAuto: false,
    })
  })
})
