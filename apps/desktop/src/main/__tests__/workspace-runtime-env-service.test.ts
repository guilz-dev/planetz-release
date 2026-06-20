import './workspace-runtime-test-mocks.js'
import { describe, expect, it } from 'vitest'
import { WorkspaceRuntimeEnvService } from '../session/workspace-runtime-env-service.js'
import type { WorkspaceRuntimePort } from '../session/workspace-runtime-port.js'
import { createWorkspaceRuntimeStack } from './workspace-runtime-test-port.js'

describe('WorkspaceRuntimeEnvService', () => {
  it('requireIsolatedRepoPath throws when isolated workspace is missing', () => {
    const port = { isolatedTaktWorkspace: null } as WorkspaceRuntimePort
    const env = new WorkspaceRuntimeEnvService(port)
    expect(() => env.requireIsolatedRepoPath()).toThrow('No isolated takt workspace')
  })

  it('buildExecutionProfileContext loads engine config after workspace is open', async () => {
    const { env, facade } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })
    await facade.openWorkspace('/tmp/ws')

    const ctx = env.buildExecutionProfileContext()
    await expect(ctx.loadEngineConfig()).resolves.toEqual({})
    expect(env.requireIsolatedRepoPath()).toBe('/tmp/ws/.isolated-repo')
  })

  it('resolveTaktRuntimeEnv returns env map when workspace is open', async () => {
    const { env, facade } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })
    await facade.openWorkspace('/tmp/ws')

    await expect(env.resolveTaktRuntimeEnv()).resolves.toEqual({})
  })
})
