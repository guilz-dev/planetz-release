import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyEngineConfigPatch } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { EngineConfigStore } from '../../planetz/engine-config-store.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

describe('EngineConfigStore', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('returns runtime defaults when file is missing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-'))
    const store = new EngineConfigStore()
    const config = await store.load(mockSidecarPaths(dir))
    expect(config).toEqual({ logging: { providerEvents: true } })
    expect(await store.exists(mockSidecarPaths(dir))).toBe(false)
  })

  it('round-trips provider and model', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const store = new EngineConfigStore()
    await store.save(paths, { provider: 'anthropic', model: 'claude' })
    const loaded = await store.load(paths)
    expect(loaded.provider).toBe('anthropic')
    expect(loaded.model).toBe('claude')
    expect(await store.exists(paths)).toBe(true)
  })

  it('round-trips passthrough keys', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const store = new EngineConfigStore()
    await store.save(paths, {
      provider: 'anthropic',
      task_poll_interval_ms: 750,
      notification_sound: false,
    })
    const loaded = await store.load(paths)
    expect(loaded.provider).toBe('anthropic')
    expect(loaded.task_poll_interval_ms).toBe(750)
    expect(loaded.notification_sound).toBe(false)
  })

  it('round-trips persona_providers', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const store = new EngineConfigStore()
    await store.save(paths, {
      persona_providers: {
        coder: { provider: 'anthropic', model: 'claude' },
        reviewer: 'openai',
      },
    })
    const loaded = await store.load(paths)
    expect(loaded.persona_providers).toEqual({
      coder: { provider: 'anthropic', model: 'claude' },
      reviewer: 'openai',
    })
  })

  it('drops cleared provider and persona_providers from persisted yaml', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-clear-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const store = new EngineConfigStore()
    await store.save(paths, {
      provider: 'cursor',
      model: 'auto',
      persona_providers: { coder: { provider: 'anthropic' } },
    })
    const cleared = applyEngineConfigPatch(await store.load(paths), {
      provider: '',
      model: '',
      persona_providers: {},
    })
    await store.save(paths, cleared)
    const raw = await readFile(paths.engineConfigPath, 'utf8')
    expect(raw).not.toMatch(/^provider:/m)
    expect(raw).not.toMatch(/^model:/m)
    expect(raw).not.toContain('persona_providers')
  })

  it('rejects invalid yaml shape', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-engine-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    await writeFile(paths.engineConfigPath, 'concurrency: not-a-number\n', 'utf8')
    const store = new EngineConfigStore()
    await expect(store.load(paths)).rejects.toThrow()
  })
})
