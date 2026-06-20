import './workspace-runtime-test-mocks.js'
import { describe, expect, it } from 'vitest'
import { createWorkspaceRuntimeStack } from './workspace-runtime-test-port.js'

describe('WorkspaceRuntimeService', () => {
  it('delegates openWorkspace to WorkspaceOpenService', async () => {
    const { facade, port } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })

    await facade.openWorkspace('/tmp/ws')

    expect(port.workspacePath).toBe('/tmp/ws')
    expect(port.refreshState).toHaveBeenCalled()
  })

  it('delegates startWatch to WorkspaceWatchService', async () => {
    const { facade, port } = createWorkspaceRuntimeStack({ canonicalImportPromptSeen: true })
    await facade.openWorkspace('/tmp/ws')

    await facade.startWatch()

    expect(port.connection.watch).toBe('running')
  })
})
