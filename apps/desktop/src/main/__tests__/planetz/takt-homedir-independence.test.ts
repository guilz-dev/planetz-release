import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTaktWorkflowYaml } from '../../planetz/takt-import-sources.js'
import { buildTaktRuntimeEnv } from '../../planetz/takt-runtime-adapter.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

describe('takt homedir independence', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('resolveTaktWorkflowYaml reads sidecar workflows only (not home layer)', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-no-home-'))
    const orbitWf = join(workspace, SIDECAR_DIR_NAME, 'workflows')
    await mkdir(orbitWf, { recursive: true })
    await writeFile(
      join(orbitWf, 'orbit-only.yaml'),
      'name: orbit-only\nsteps:\n  - name: plan\n    persona: orbit\n',
      'utf8',
    )

    const resolved = await resolveTaktWorkflowYaml(workspace, DEFAULT_CONFIG, 'orbit-only')
    expect(resolved?.layer).toBe('orbit')
    expect(resolved?.path).toBe(`${SIDECAR_DIR_NAME}/workflows/orbit-only.yaml`)
  })

  it('buildTaktRuntimeEnv uses workspace sidecar takt-global', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-global-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))

    const env = await buildTaktRuntimeEnv(paths, {}, workspace)
    expect(env.TAKT_CONFIG_DIR).toBe(join(workspace, SIDECAR_DIR_NAME, 'takt-global'))
  })
})
