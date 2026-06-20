import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../../shared/spec-driven/spec-driven-workflow-yaml.js'
import { captureRunSupplySnapshot } from '../run-supply-snapshot.js'

describe('captureRunSupplySnapshot', () => {
  it('records an empty snapshot when workflow lacks established-decisions facet', async () => {
    const regenerateEstablishedDecisionsForTask = vi.fn(async () => ['entry-1'])
    const upsertTaskSupplySnapshot = vi.fn(async () => {})
    const port = {
      readWorkflowYaml: vi.fn(async () => 'steps:\n  - run: echo'),
      regenerateEstablishedDecisionsForTask,
      regenerateDecidedIntentContextForTask: vi.fn(async () => false),
      upsertTaskSupplySnapshot,
    }

    await captureRunSupplySnapshot(port, 'task-1', {
      title: 'Run',
      body: 'body',
      workflow: 'default',
    })

    expect(regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
    expect(upsertTaskSupplySnapshot).toHaveBeenCalledWith('task-1', [])
  })

  it('regenerates and persists matched entry ids for spec-driven workflows', async () => {
    const regenerateEstablishedDecisionsForTask = vi.fn(async () => ['entry-a', 'entry-b'])
    const upsertTaskSupplySnapshot = vi.fn(async () => {})
    const regenerateDecidedIntentContextForTask = vi.fn(async () => true)
    const port = {
      readWorkflowYaml: vi.fn(async () => SPEC_DRIVEN_WORKFLOW_YAML),
      regenerateEstablishedDecisionsForTask,
      regenerateDecidedIntentContextForTask,
      upsertTaskSupplySnapshot,
    }
    const input = {
      title: 'Run',
      body: 'body',
      workflow: SPEC_DRIVEN_WORKFLOW_NAME,
    }

    await captureRunSupplySnapshot(port, 'task-9', input)

    expect(regenerateEstablishedDecisionsForTask).toHaveBeenCalledWith(input)
    expect(regenerateDecidedIntentContextForTask).toHaveBeenCalledWith('task-9')
    expect(upsertTaskSupplySnapshot).toHaveBeenCalledWith('task-9', ['entry-a', 'entry-b'])
  })

  it('still upserts an empty snapshot when workflow yaml read fails', async () => {
    const upsertTaskSupplySnapshot = vi.fn(async () => {})
    const port = {
      readWorkflowYaml: vi.fn(async () => {
        throw new Error('missing workflow')
      }),
      regenerateEstablishedDecisionsForTask: vi.fn(async () => []),
      regenerateDecidedIntentContextForTask: vi.fn(async () => false),
      upsertTaskSupplySnapshot,
    }

    await captureRunSupplySnapshot(port, 'task-2', {
      title: 'Run',
      body: 'body',
      workflow: SPEC_DRIVEN_WORKFLOW_NAME,
    })

    expect(upsertTaskSupplySnapshot).toHaveBeenCalledWith('task-2', [])
  })
})
