import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, type EngineConfig, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildTaktRuntimeEnv,
  resolveRuntimeWorkflow,
  taktGlobalWorkflowsDir,
} from '../../planetz/takt-runtime-adapter.js'
import { PlanetzWorkflowCanonicalManager } from '../../planetz/workflow-canonical-manager.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

describe('takt runtime adapter', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('returns runtime workflow path when file exists', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-adapter-'))
    const sidecar = join(workspace, SIDECAR_DIR_NAME)
    const paths = mockSidecarPaths(sidecar)
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(
      join(paths.planetzWorkflowsDir, 'default.yaml'),
      'name: default\nsteps:\n  - name: plan\n    persona: planner\n',
      'utf8',
    )
    const mgr = new PlanetzWorkflowCanonicalManager(workspace, DEFAULT_CONFIG, paths)

    const resolved = await resolveRuntimeWorkflow(mgr, paths, {}, 'default', workspace)
    expect(resolved.workflow).toBe(`${SIDECAR_DIR_NAME}/runtime-workflows/default.yaml`)
    expect(resolved.yaml).toContain('name: default')
    const taktGlobalYaml = await readFile(
      join(taktGlobalWorkflowsDir(paths), 'default.yaml'),
      'utf8',
    )
    expect(taktGlobalYaml).toContain('name: default')
  })

  it(
    'materializes canonical workflow when only isolated project .takt source exists',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-materialize-'))
      const taktRepo = await mkdtemp(join(tmpdir(), 'planetz-runtime-takt-repo-'))
      const sidecar = join(workspace, SIDECAR_DIR_NAME)
      const paths = mockSidecarPaths(sidecar)
      await mkdir(join(taktRepo, '.takt', 'workflows'), { recursive: true })
      await writeFile(
        join(taktRepo, '.takt', 'workflows', 'custom.yaml'),
        'name: custom\nsteps:\n  - name: implement\n    persona: coder\n',
        'utf8',
      )
      const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }
      const mgr = new PlanetzWorkflowCanonicalManager(workspace, config, paths, taktRepo)

      const resolved = await resolveRuntimeWorkflow(mgr, paths, {}, 'custom', workspace)
      expect(resolved.workflow).toBe(`${SIDECAR_DIR_NAME}/runtime-workflows/custom.yaml`)
      const written = await readFile(join(paths.planetzWorkflowsDir, 'custom.yaml'), 'utf8')
      expect(written).toContain('name: custom')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('writes TAKT_CONFIG_DIR under workspace sidecar takt-global', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-env-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })
    const engine: EngineConfig = {
      persona_providers: { coder: { provider: 'anthropic', model: 'claude' } },
      rate_limit_fallback: { switch_chain: [{ provider: 'openai', model: 'gpt-4.1' }] },
    }

    const env = await buildTaktRuntimeEnv(paths, engine, workspace)
    expect(env.TAKT_CONFIG_DIR).toBe(join(workspace, SIDECAR_DIR_NAME, 'takt-global'))
    expect(env.TAKT_PERSONA_PROVIDERS).toContain('"coder"')
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).toContain('persona_providers')
    expect(configYaml).toContain('rate_limit_fallback')
    expect(configYaml).toContain('language: en')
    expect(configYaml).toContain('concurrency: 1')
  })

  it('writes engine language and concurrency into runtime global config', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-lang-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    const env = await buildTaktRuntimeEnv(paths, { language: 'ja', concurrency: 2 }, workspace)
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).toContain('language: ja')
    expect(configYaml).toContain('concurrency: 2')
  })

  it('writes provider_options and OLLAMA_HOST for ollama engine', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-ollama-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    const env = await buildTaktRuntimeEnv(
      paths,
      {
        provider: 'ollama',
        model: 'llama3.2:latest',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      },
      workspace,
    )
    expect(env.OLLAMA_HOST).toBe('127.0.0.1:11434')
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).toContain('provider_options:')
    expect(configYaml).toContain('base_url: http://127.0.0.1:11434')
  })

  it('writes engine provider and model into runtime global config', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-provider-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    await mkdir(paths.root, { recursive: true })

    const env = await buildTaktRuntimeEnv(
      paths,
      { provider: 'cursor', model: 'composer-2.5' },
      workspace,
    )
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).toContain('provider: cursor')
    expect(configYaml).toContain('model: composer-2.5')
  })

  it('drops stale provider and model from runtime config when engine clears them', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-provider-clear-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    const globalDir = join(workspace, SIDECAR_DIR_NAME, 'takt-global')
    await mkdir(globalDir, { recursive: true })
    await writeFile(join(globalDir, 'config.yaml'), 'provider: cursor\nmodel: old-model\n', 'utf8')

    await buildTaktRuntimeEnv(paths, {}, workspace)
    const configYaml = await readFile(join(globalDir, 'config.yaml'), 'utf8')
    expect(configYaml).not.toMatch(/^provider:/m)
    expect(configYaml).not.toMatch(/^model:/m)
  })

  it('omits TAKT_PERSONA_PROVIDERS when engine persona map is empty', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-env-clear-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    const globalDir = join(workspace, SIDECAR_DIR_NAME, 'takt-global')
    await mkdir(globalDir, { recursive: true })
    await writeFile(
      join(globalDir, 'config.yaml'),
      'persona_providers:\n  coder:\n    provider: anthropic\n',
      'utf8',
    )

    const env = await buildTaktRuntimeEnv(paths, {}, workspace)
    expect(env.TAKT_PERSONA_PROVIDERS).toBeUndefined()
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).not.toContain('persona_providers')
  })

  it('preserves existing workspace global config when building runtime config', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-env-preserve-'))
    const paths = mockSidecarPaths(join(workspace, SIDECAR_DIR_NAME))
    const globalDir = join(workspace, SIDECAR_DIR_NAME, 'takt-global')
    await mkdir(globalDir, { recursive: true })
    await writeFile(
      join(globalDir, 'config.yaml'),
      'provider: openai\nmodel: gpt-base\napi_keys:\n  openai: sk-test\n',
      'utf8',
    )

    const env = await buildTaktRuntimeEnv(
      paths,
      {
        provider: 'openai',
        model: 'gpt-base',
        rate_limit_fallback: { switch_chain: [{ provider: 'anthropic', model: 'claude' }] },
      },
      workspace,
    )
    const configYaml = await readFile(join(env.TAKT_CONFIG_DIR as string, 'config.yaml'), 'utf8')
    expect(configYaml).toContain('provider: openai')
    expect(configYaml).toContain('model: gpt-base')
    expect(configYaml).toContain('api_keys:')
    expect(configYaml).toContain('rate_limit_fallback:')
  })

  it('supplements engine switch_chain when workflow lacks fallback', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-runtime-fallback-'))
    const sidecar = join(workspace, SIDECAR_DIR_NAME)
    const paths = mockSidecarPaths(sidecar)
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(
      join(paths.planetzWorkflowsDir, 'wf.yaml'),
      'name: wf\nsteps:\n  - name: plan\n    persona: planner\n',
      'utf8',
    )
    const mgr = new PlanetzWorkflowCanonicalManager(workspace, DEFAULT_CONFIG, paths)

    const resolved = await resolveRuntimeWorkflow(
      mgr,
      paths,
      { rate_limit_fallback: { switch_chain: [{ provider: 'openai', model: 'gpt-4.1' }] } },
      'wf',
      workspace,
    )
    expect(resolved.workflow).toBe(`${SIDECAR_DIR_NAME}/runtime-workflows/wf.yaml`)
    expect(resolved.yaml).toContain('rate_limit_fallback')
    expect(resolved.yaml).toContain('switch_chain')
  })
})
