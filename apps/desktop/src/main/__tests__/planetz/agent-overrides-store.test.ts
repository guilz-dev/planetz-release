import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentOverridesStore } from '../../planetz/agent-overrides-store.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

describe('AgentOverridesStore', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('returns empty overrides when file is missing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-agent-overrides-'))
    const store = new AgentOverridesStore()
    const overrides = await store.load(mockSidecarPaths(dir))
    expect(overrides).toEqual({})
    expect(await store.exists(mockSidecarPaths(dir))).toBe(false)
  })

  it('round-trips persona_providers', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-agent-overrides-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const store = new AgentOverridesStore()
    await store.save(paths, {
      persona_providers: {
        planner: { provider: 'anthropic', model: 'claude' },
      },
    })
    const loaded = await store.load(paths)
    expect(loaded.persona_providers).toEqual({
      planner: { provider: 'anthropic', model: 'claude' },
    })
    expect(await store.exists(paths)).toBe(true)
  })
})
