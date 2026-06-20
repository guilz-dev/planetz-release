import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BUNDLED_ORBIT_CLI_NOT_FOUND_FIRST_LINE,
  type EngineConfig,
  readPlanetzEnv,
  type UiConfig,
} from '@planetz/shared'
import { type Options as ExecaOptions, execa } from 'execa'
import { buildWorkspaceBundledTaktEnv } from '../planetz/takt-runtime-adapter.js'
import {
  isElectronBinary,
  isUsableNodeRunnerPath,
  lookupNodeBinaryOnPath,
} from './node-runner-binary-lookup.js'

const BUNDLED_ORBIT_CLI_RELATIVE = join('dist', 'app', 'cli', 'index.js')

export interface TaktCliCommand {
  file: string
  args: string[]
}

export class BundledOrbitNotFoundError extends Error {
  readonly code = 'bundled_orbit_not_found'

  constructor(readonly candidates: string[]) {
    super(
      [
        BUNDLED_ORBIT_CLI_NOT_FOUND_FIRST_LINE,
        `Expected: ${BUNDLED_ORBIT_CLI_RELATIVE}`,
        'Run `pnpm prepare:bundled-orbit` for development, or package with bundled resources.',
        ...candidates.map((path) => `- ${path}`),
      ].join('\n'),
    )
    this.name = 'BundledOrbitNotFoundError'
  }
}

/** @deprecated Use {@link BundledOrbitNotFoundError}. */
export const BundledTaktNotFoundError = BundledOrbitNotFoundError

/** Roots searched for bundled orbit engine resources (facets, CLI, etc.). */
export function candidateBundledOrbitRoots(): string[] {
  const roots = new Set<string>()
  if (allowTestOverride()) {
    const envRoot = readPlanetzEnv('BUNDLED_ORBIT_ROOT')
    if (envRoot) roots.add(resolve(envRoot))
  }

  const resourcesPath = process.resourcesPath?.trim()
  if (resourcesPath) {
    roots.add(resolve(resourcesPath, 'orbit'))
    roots.add(resolve(resourcesPath, 'third_party', 'orbit'))
    roots.add(resolve(resourcesPath, 'app.asar.unpacked', 'orbit'))
    roots.add(resolve(resourcesPath, 'app.asar.unpacked', 'third_party', 'orbit'))
  }

  roots.add(resolve(process.cwd(), 'third_party', 'orbit'))
  roots.add(resolve(process.cwd(), 'resources', 'orbit'))
  roots.add(resolve(process.cwd(), 'apps', 'desktop', 'resources', 'orbit'))

  const moduleDir = dirname(fileURLToPath(import.meta.url))
  let cursor = moduleDir
  for (let depth = 0; depth < MAX_PARENT_SEARCH_DEPTH; depth += 1) {
    roots.add(resolve(cursor, 'third_party', 'orbit'))
    cursor = resolve(cursor, '..')
  }

  return [...roots]
}

/** @deprecated Use {@link candidateBundledOrbitRoots}. */
export const candidateBundledTaktRoots = candidateBundledOrbitRoots

function resolveBundledOrbitCliPath(): string {
  const candidateCliPaths: string[] = []
  for (const root of candidateBundledOrbitRoots()) {
    const cliPath = join(root, BUNDLED_ORBIT_CLI_RELATIVE)
    candidateCliPaths.push(cliPath)
    if (existsSync(cliPath) && isRunnableBundledRoot(root)) {
      return cliPath
    }
  }
  throw new BundledOrbitNotFoundError(candidateCliPaths)
}

function allowTestOverride(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
}

const MAX_PARENT_SEARCH_DEPTH = 8

function isRunnableBundledRoot(root: string): boolean {
  return existsSync(join(root, 'package.json')) && existsSync(join(root, 'node_modules'))
}

/** Orbit root with package.json and node_modules (required for provider LLM calls). */
export function resolveRunnableBundledOrbitRoot(): string {
  for (const root of candidateBundledOrbitRoots()) {
    if (isRunnableBundledRoot(root)) return root
  }
  throw new BundledOrbitNotFoundError(
    candidateBundledOrbitRoots().map((root) => join(root, BUNDLED_ORBIT_CLI_RELATIVE)),
  )
}

export { isElectronBinary } from './node-runner-binary-lookup.js'

export class NodeRunnerBinaryNotFoundError extends Error {
  readonly code = 'node_runner_not_found'

  constructor() {
    super(
      [
        'Could not resolve a Node binary for bundled takt/orbit runners.',
        'Set PLANETZ_NODE_BINARY to your Node executable (not Electron).',
        'Electron paths in PLANETZ_NODE_BINARY and npm_node_execpath are ignored to avoid duplicate Dock icons.',
      ].join(' '),
    )
    this.name = 'NodeRunnerBinaryNotFoundError'
  }
}

/**
 * Binary used to execute bundled takt CLI.
 * Electron-as-Node mis-parses Commander subcommands such as `add` (routes to interactive mode).
 */
export function resolveTaktCliRunnerBinary(): string {
  if (!process.versions.electron) {
    return process.execPath
  }
  const override = process.env.PLANETZ_NODE_BINARY?.trim()
  if (override && isUsableNodeRunnerPath(override)) {
    return override
  }
  const npmNode = process.env.npm_node_execpath?.trim()
  if (npmNode && isUsableNodeRunnerPath(npmNode)) {
    return npmNode
  }
  const fromPath = lookupNodeBinaryOnPath()
  if (fromPath) return fromPath
  throw new NodeRunnerBinaryNotFoundError()
}

export function resolveTaktCliCommand(_config: UiConfig, args: string[]): TaktCliCommand {
  const bundledCliPath = resolveBundledOrbitCliPath()
  return {
    file: resolveTaktCliRunnerBinary(),
    args: [bundledCliPath, ...args],
  }
}

export function runTaktCli(config: UiConfig, args: string[], options: ExecaOptions = {}) {
  const command = resolveTaktCliCommand(config, args)
  const stdinDefault =
    options.stdin === undefined && options.stdio === undefined ? { stdin: 'ignore' as const } : {}
  const runnerEnv = {
    ...process.env,
    ...(options.env as Record<string, string> | undefined),
  } as Record<string, string>
  if (isElectronBinary(command.file)) {
    runnerEnv.ELECTRON_RUN_AS_NODE = '1'
  }
  return execa(command.file, command.args, {
    ...options,
    // Open pipe stdin makes bundled takt `confirm()` wait forever on non-TTY runs.
    ...stdinDefault,
    env: runnerEnv,
  })
}

/** Bundled takt CLI with workspace-global `TAKT_CONFIG_DIR` applied. */
export async function runTaktCliInWorkspace(
  config: UiConfig,
  workspacePath: string,
  args: string[],
  options: ExecaOptions & { engine?: EngineConfig } = {},
) {
  const { engine, ...execaOptions } = options
  const bundledEnv = await buildWorkspaceBundledTaktEnv(workspacePath, engine ?? {})
  return runTaktCli(config, args, {
    ...execaOptions,
    env: { ...bundledEnv, ...execaOptions.env },
  })
}

export function outputText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return new TextDecoder().decode(value)
  if (Array.isArray(value)) return value.map((item) => String(item)).join('\n')
  return value == null ? '' : String(value)
}
