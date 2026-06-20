import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentOverridesStore } from '../../planetz/agent-overrides-store.js'
import { loadEffectiveEngineConfig } from '../../planetz/effective-engine-config.js'
import { EngineConfigStore } from '../../planetz/engine-config-store.js'
import { buildTaktRuntimeEnv } from '../../planetz/takt-runtime-adapter.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

describe('loadEffectiveEngineConfig', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('merges overrides into engine config for runtime env', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-effective-engine-'))
    await mkdir(dir, { recursive: true })
    const paths = mockSidecarPaths(dir)
    const engineStore = new EngineConfigStore()
    const overridesStore = new AgentOverridesStore()

    await engineStore.save(paths, {
      persona_providers: { coder: { provider: 'openai', model: 'gpt' } },
    })
    await overridesStore.save(paths, {
      persona_providers: { coder: { provider: 'anthropic', model: 'claude' } },
    })

    const effective = await loadEffectiveEngineConfig(engineStore, overridesStore, paths)
    expect(effective.persona_providers?.coder).toEqual({
      provider: 'anthropic',
      model: 'claude',
    })

    const env = await buildTaktRuntimeEnv(paths, effective)
    expect(env.TAKT_PERSONA_PROVIDERS).toContain('"anthropic"')
    expect(env.TAKT_PERSONA_PROVIDERS).not.toContain('"openai"')
  })

  it('reads overrides from disk when building effective config', async () => {
    dir = await mkdtemp(join(tmpdir(), 'planetz-effective-engine-'))
    await mkdir(join(dir, 'agents'), { recursive: true })
    const paths = mockSidecarPaths(dir)
    await writeFile(paths.engineConfigPath, 'persona_providers:\n  reviewer: openai\n', 'utf8')
    await writeFile(
      paths.agentOverridesPath,
      'persona_providers:\n  reviewer:\n    provider: anthropic\n    model: claude\n',
      'utf8',
    )

    const effective = await loadEffectiveEngineConfig(
      new EngineConfigStore(),
      new AgentOverridesStore(),
      paths,
    )
    expect(effective.persona_providers?.reviewer).toEqual({
      provider: 'anthropic',
      model: 'claude',
    })
  })
})
