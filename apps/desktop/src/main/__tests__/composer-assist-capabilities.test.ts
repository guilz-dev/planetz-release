import { existsSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('../takt/exec-cli.js', () => ({
  resolveRunnableBundledOrbitRoot: vi.fn(() => '/tmp/orbit'),
}))

describe('composer-assist-capabilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.mocked(existsSync).mockReset()
  })

  it('prefers interactive-assistant when headless dist is built', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mod = await import('../planetz/composer-assist-capabilities.js')
    expect(mod.isHeadlessInteractiveRunnerReady()).toBe(true)
    expect(mod.resolveComposerAssistStartMode()).toBe('interactive-assistant')
  })

  it('falls back to planning-only when headless dist is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const mod = await import('../planetz/composer-assist-capabilities.js')
    expect(mod.isHeadlessInteractiveRunnerReady()).toBe(false)
    expect(mod.resolveComposerAssistStartMode()).toBe('planning-only')
  })

  it('honors PLANETZ_INTERACTIVE_ASSIST even without dist', async () => {
    vi.stubEnv('PLANETZ_INTERACTIVE_ASSIST', '1')
    vi.mocked(existsSync).mockReturnValue(false)
    const mod = await import('../planetz/composer-assist-capabilities.js')
    expect(mod.resolveComposerAssistStartMode()).toBe('interactive-assistant')
  })
})
