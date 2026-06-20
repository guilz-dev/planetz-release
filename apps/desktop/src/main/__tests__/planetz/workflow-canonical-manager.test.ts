import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

describe('PlanetzWorkflowCanonicalManager builtin catalog', {
  timeout: BUNDLED_CLI_TEST_TIMEOUT_MS,
}, () => {
  let workspace = ''

  afterEach(async () => {
    const dir = workspace
    workspace = ''
    if (dir) {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })

  it('lists frontend-refactor-mock as builtin and reads yaml', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-canonical-builtin-'))
    await mkdir(join(workspace, '.orbit'), { recursive: true })
    const paths = mockSidecarPaths(join(workspace, '.orbit'))
    const mgr = new PlanetzWorkflowCanonicalManager(workspace, DEFAULT_CONFIG, paths)

    const items = await mgr.list()
    const builtin = items.find(
      (item) => item.name === 'frontend-refactor-mock' && item.source === 'builtin',
    )
    expect(builtin).toBeDefined()
    expect(builtin?.categories).toContain('🎨 Frontend')
    expect(builtin?.formEditable).toBe(true)
    expect(builtin?.formMode).toBe('partial')

    const read = await mgr.read('frontend-refactor-mock', 'builtin')
    expect(read.source).toBe('builtin')
    expect(read.yaml).toContain('name: frontend-refactor-mock')
  })
})
