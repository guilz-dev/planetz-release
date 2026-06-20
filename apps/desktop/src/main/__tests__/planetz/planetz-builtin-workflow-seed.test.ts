import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SIDECAR_DIR_NAME, SPEC_DRIVEN_WORKFLOW_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureBuiltinWorkflowFiles } from '../../planetz/planetz-builtin-workflow-seed.js'
import {
  syncPlanetzWorkflowsToTaktGlobal,
  taktGlobalWorkflowsDir,
} from '../../planetz/takt-runtime-adapter.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

describe('ensureBuiltinWorkflowFiles', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('seeds product workflows (default, minimal, chat-investigation)', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-builtin-seed-product-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    const result = await ensureBuiltinWorkflowFiles(paths, 'product')
    expect(result.workflowsCreated).toBe(3)

    const defaultYaml = await readFile(join(paths.planetzWorkflowsDir, 'default.yaml'), 'utf8')
    expect(defaultYaml).toContain('name: default')
    const minimalYaml = await readFile(join(paths.planetzWorkflowsDir, 'minimal.yaml'), 'utf8')
    expect(minimalYaml).toContain('name: minimal')
    const chatYaml = await readFile(
      join(paths.planetzWorkflowsDir, 'chat-investigation.yaml'),
      'utf8',
    )
    expect(chatYaml).toContain('name: chat-investigation')
    await expect(
      access(join(paths.planetzWorkflowsDir, `${SPEC_DRIVEN_WORKFLOW_NAME}.yaml`)),
    ).rejects.toThrow()
  })

  it('seeds runtime-fallback workflows including ollama-chat', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-builtin-seed-runtime-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    const result = await ensureBuiltinWorkflowFiles(paths, 'runtime-fallback')
    expect(result.workflowsCreated).toBeGreaterThanOrEqual(4)

    const ollamaYaml = await readFile(join(paths.planetzWorkflowsDir, 'ollama-chat.yaml'), 'utf8')
    expect(ollamaYaml).toContain('name: ollama-chat')
  })

  it('is idempotent when canonical copies already exist', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-builtin-seed-idempotent-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await ensureBuiltinWorkflowFiles(paths, 'product')
    const again = await ensureBuiltinWorkflowFiles(paths, 'product')
    expect(again.workflowsCreated).toBe(0)
  })

  it('syncs seeded minimal into takt-global after ensure + sync', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-builtin-seed-takt-global-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    await ensureBuiltinWorkflowFiles(paths, 'runtime-fallback')
    await syncPlanetzWorkflowsToTaktGlobal(paths)

    const minimalYaml = await readFile(join(taktGlobalWorkflowsDir(paths), 'minimal.yaml'), 'utf8')
    expect(minimalYaml).toContain('name: minimal')
  })
})
