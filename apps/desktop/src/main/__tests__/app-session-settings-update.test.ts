import { DEFAULT_CONFIG, type UiConfig } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppSession } from '../app-session.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

function configForTest(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { autoStart: true },
    ui: { ...DEFAULT_CONFIG.ui },
  }
}

function createSession(): AppSession {
  const session = new AppSession()
  session.workspacePath = '/tmp/ws'
  session.sidecarPaths = mockSidecarPaths('/tmp/ws/.orbit')
  session.config = configForTest()
  return session
}

describe('AppSession.updateConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not update global ui preferences when workspace config save fails first', async () => {
    const session = createSession()
    const saveConfigMock = vi
      .spyOn(session.sidecarStore, 'saveConfig')
      .mockRejectedValueOnce(new Error('disk full'))
    const setGlobalUiPreferencesMock = vi.spyOn(
      session.workspaceSessionStore,
      'setGlobalUiPreferences',
    )

    await expect(session.updateConfig({ ui: { theme: 'operations' } })).rejects.toThrow('disk full')
    expect(setGlobalUiPreferencesMock).not.toHaveBeenCalled()
    expect(saveConfigMock).toHaveBeenCalledTimes(1)
    expect(session.config?.ui.theme).toBe('default')
  })

  it('preserves workspace theme when toggling counter pack only', async () => {
    const session = createSession()
    session.config = {
      ...configForTest(),
      ui: { ...configForTest().ui, theme: 'operations', counterPackEnabled: false },
    }
    vi.spyOn(session.sidecarStore, 'saveConfig').mockResolvedValue()
    const setGlobalUiPreferencesMock = vi
      .spyOn(session.workspaceSessionStore, 'setGlobalUiPreferences')
      .mockResolvedValue({
        theme: 'operations',
        counterPackEnabled: true,
        language: 'en',
      })

    const result = await session.updateConfig({ ui: { counterPackEnabled: true } })

    expect(setGlobalUiPreferencesMock).toHaveBeenCalledWith({
      theme: 'operations',
      counterPackEnabled: true,
      language: 'en',
    })
    expect(result.ui.theme).toBe('operations')
    expect(result.ui.counterPackEnabled).toBe(true)
  })

  it('rolls back workspace config when global ui preference save fails', async () => {
    const session = createSession()
    const saveConfigMock = vi.spyOn(session.sidecarStore, 'saveConfig').mockResolvedValue()
    const setGlobalUiPreferencesMock = vi
      .spyOn(session.workspaceSessionStore, 'setGlobalUiPreferences')
      .mockRejectedValueOnce(new Error('session write failed'))

    await expect(
      session.updateConfig({ watch: { autoStart: false }, ui: { theme: 'operations' } }),
    ).rejects.toThrow('session write failed')

    expect(setGlobalUiPreferencesMock).toHaveBeenCalledTimes(1)
    expect(saveConfigMock).toHaveBeenCalledTimes(2)
    expect(saveConfigMock.mock.calls[0]?.[1].watch.autoStart).toBe(false)
    expect(saveConfigMock.mock.calls[0]?.[1].ui.theme).toBe('operations')
    expect(saveConfigMock.mock.calls[1]?.[1].watch.autoStart).toBe(true)
    expect(saveConfigMock.mock.calls[1]?.[1].ui.theme).toBe('default')
    expect(session.config?.watch.autoStart).toBe(true)
    expect(session.config?.ui.theme).toBe('default')
  })
})
