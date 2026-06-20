import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, type UiConfig } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { WatchStateStore } from '../sidecar/watch-state-store.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { WatchManager } from '../takt/watch-manager.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

const BUNDLED_TAKT_ROOT_ENV = 'PLANETZ_BUNDLED_TAKT_ROOT'
const PREVIOUS_BUNDLED_ROOT = process.env[BUNDLED_TAKT_ROOT_ENV]
const ACTIVE_MANAGERS: { manager: WatchManager; paths: SidecarPaths }[] = []

function configForTest(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
  }
}

async function createBundledCliFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'watch-bundled-takt-'))
  const cliDir = join(root, 'dist', 'app', 'cli')
  await mkdir(cliDir, { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await writeFile(join(root, 'package.json'), '{"name":"watch-fixture"}\n', 'utf8')
  await writeFile(
    join(cliDir, 'index.js'),
    [
      'const args = process.argv.slice(2)',
      "if (args[0] === 'watch') {",
      '  setInterval(() => {}, 60_000)',
      '} else {',
      '  process.exit(0)',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  return root
}

async function createBundledCliFixtureWithEnvProbe(probePath: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'watch-bundled-takt-env-'))
  const cliDir = join(root, 'dist', 'app', 'cli')
  await mkdir(cliDir, { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await writeFile(join(root, 'package.json'), '{"name":"watch-fixture-env"}\n', 'utf8')
  await writeFile(
    join(cliDir, 'index.js'),
    [
      "const fs = require('node:fs')",
      'const args = process.argv.slice(2)',
      "if (args[0] === 'watch') {",
      `  fs.writeFileSync(${JSON.stringify(probePath)}, process.env.TAKT_PERSONA_PROVIDERS || '', 'utf8')`,
      '  setInterval(() => {}, 60_000)',
      '} else {',
      '  process.exit(0)',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  return root
}

describe('WatchManager', () => {
  afterEach(async () => {
    await Promise.all(
      ACTIVE_MANAGERS.splice(0).map(async ({ manager, paths }) => {
        await manager.stop(paths)
      }),
    )
    closeAllSidecarSqlite()
    if (PREVIOUS_BUNDLED_ROOT === undefined) {
      delete process.env[BUNDLED_TAKT_ROOT_ENV]
    } else {
      process.env[BUNDLED_TAKT_ROOT_ENV] = PREVIOUS_BUNDLED_ROOT
    }
  })

  it('starts and stops a detached watch process while persisting watch-state', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'watch-manager-ws-'))
    const sidecar = await mkdtemp(join(tmpdir(), 'watch-manager-sidecar-'))
    process.env[BUNDLED_TAKT_ROOT_ENV] = await createBundledCliFixture()

    const paths = mockSidecarPaths(sidecar)
    const manager = new WatchManager(workspace, configForTest())
    ACTIVE_MANAGERS.push({ manager, paths })
    const watchStateStore = new WatchStateStore()

    const started = await manager.start(paths)
    expect(started).toBe('running')

    const saved = await watchStateStore.load(paths)
    expect(typeof saved.pid).toBe('number')
    expect(saved.pid).toBeGreaterThan(0)

    const stopped = await manager.stop(paths)
    expect(stopped).toBe('stopped')
    const cleared = await watchStateStore.load(paths)
    expect(cleared.pid).toBeUndefined()
  })

  it('passes runtime env values to watch process', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'watch-manager-env-ws-'))
    const sidecar = await mkdtemp(join(tmpdir(), 'watch-manager-env-sidecar-'))
    const probePath = join(sidecar, 'watch-env.txt')
    process.env[BUNDLED_TAKT_ROOT_ENV] = await createBundledCliFixtureWithEnvProbe(probePath)

    const paths = mockSidecarPaths(sidecar)
    const manager = new WatchManager(workspace, configForTest())
    ACTIVE_MANAGERS.push({ manager, paths })

    const started = await manager.start(paths, {
      TAKT_PERSONA_PROVIDERS: '{"coder":"anthropic"}',
    })
    expect(started).toBe('running')
    let captured = ''
    for (let i = 0; i < 20; i += 1) {
      try {
        captured = await readFile(probePath, 'utf8')
        if (captured.length > 0) break
      } catch {
        // wait for watch process to initialize
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(captured).toContain('coder')
  })
})
