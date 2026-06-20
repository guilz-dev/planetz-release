import { SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../../shared/spec-driven/spec-driven-workflow-yaml.js'
import { regenerateEstablishedDecisionsIfNeeded } from '../../planetz/established-decisions-regeneration.js'

describe('regenerateEstablishedDecisionsIfNeeded', () => {
  it('skips when workflow is missing or yaml does not reference the facet', async () => {
    const regenerateEstablishedDecisionsForTask = vi.fn(async () => [])
    const port = {
      readWorkflowYaml: vi.fn(async () => null),
      regenerateEstablishedDecisionsForTask,
    }

    await regenerateEstablishedDecisionsIfNeeded(port, { title: 'T', body: 'B' })
    await regenerateEstablishedDecisionsIfNeeded(port, {
      title: 'T',
      body: 'B',
      workflow: 'default',
    })

    expect(regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
  })

  it('regenerates when workflow yaml references established-decisions', async () => {
    const regenerateEstablishedDecisionsForTask = vi.fn(async () => [])
    const port = {
      readWorkflowYaml: vi.fn(async () => SPEC_DRIVEN_WORKFLOW_YAML),
      regenerateEstablishedDecisionsForTask,
    }
    const input = {
      title: 'T',
      body: 'B',
      workflow: SPEC_DRIVEN_WORKFLOW_NAME,
    }

    await regenerateEstablishedDecisionsIfNeeded(port, input)

    expect(regenerateEstablishedDecisionsForTask).toHaveBeenCalledWith(input)
  })
})
