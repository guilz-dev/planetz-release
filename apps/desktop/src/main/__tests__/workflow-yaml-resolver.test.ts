import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { resolveWorkflowYamlForRouting } from '../session/workflow-auto/workflow-yaml-resolver.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from './test-timeouts.js'

describe('resolveWorkflowYamlForRouting', { timeout: BUNDLED_CLI_TEST_TIMEOUT_MS }, () => {
  it('prefers sidecar canonical over builtin', async () => {
    const root = join(tmpdir(), `planetz-routing-resolver-${Date.now()}`)
    const sidecarWorkflowsDir = join(root, 'workflows')
    await mkdir(sidecarWorkflowsDir, { recursive: true })
    const marker = '# project-canonical-marker'
    await writeFile(
      join(sidecarWorkflowsDir, 'default.yaml'),
      `name: default\n${marker}\nsteps: []\n`,
    )

    const resolved = await resolveWorkflowYamlForRouting('default', {
      sidecarWorkflowsDir,
      workspacePath: root,
      config: DEFAULT_CONFIG,
      mode: 'production',
    })

    expect(resolved?.source).toBe('project')
    expect(resolved?.yaml).toContain(marker)
  })

  it('falls back to builtin when canonical missing', async () => {
    await ensureBuiltinWorkflowCatalogLoaded()
    const builtin = readBuiltinWorkflowYaml('default')
    expect(builtin).toBeTruthy()

    const root = join(tmpdir(), `planetz-routing-resolver-builtin-${Date.now()}`)
    const sidecarWorkflowsDir = join(root, 'workflows-empty')
    await mkdir(sidecarWorkflowsDir, { recursive: true })

    const resolved = await resolveWorkflowYamlForRouting('default', {
      sidecarWorkflowsDir,
      workspacePath: root,
      config: DEFAULT_CONFIG,
      mode: 'production',
    })

    expect(resolved?.source).toBe('builtin')
    expect(resolved?.yaml).toContain('name: default')
  })

  it('uses builtin-only mode for mock enqueue', async () => {
    await ensureBuiltinWorkflowCatalogLoaded()
    const resolved = await resolveWorkflowYamlForRouting('default', {
      sidecarWorkflowsDir: '/nonexistent',
      workspacePath: '/nonexistent',
      config: DEFAULT_CONFIG,
      mode: 'mock-builtin-only',
    })
    expect(resolved?.source).toBe('builtin')
  })
})
