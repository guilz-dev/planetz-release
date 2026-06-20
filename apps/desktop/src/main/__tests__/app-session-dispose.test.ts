import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSession } from '../app-session.js'
import { WorkspaceRuntimeService } from '../session/workspace-runtime-service.js'

describe('AppSession.dispose', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('delegates to workspaceRuntime.teardownWorkspaceRuntime', async () => {
    const teardown = vi
      .spyOn(WorkspaceRuntimeService.prototype, 'teardownWorkspaceRuntime')
      .mockResolvedValue()
    const session = new AppSession()

    await session.dispose()

    expect(teardown).toHaveBeenCalledOnce()
  })
})
