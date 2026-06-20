import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { execaMock } = vi.hoisted(() => ({
  execaMock: vi.fn(() => Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })),
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

const lookupNodeBinaryOnPathMock = vi.hoisted(() => vi.fn((): string | null => null))

vi.mock('../takt/node-runner-binary-lookup.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../takt/node-runner-binary-lookup.js')>()
  return {
    ...actual,
    lookupNodeBinaryOnPath: lookupNodeBinaryOnPathMock,
  }
})

import {
  NodeRunnerBinaryNotFoundError,
  outputText,
  resolveTaktCliCommand,
  resolveTaktCliRunnerBinary,
  runTaktCli,
} from '../takt/exec-cli.js'

const BUNDLED_TAKT_ROOT_ENV = 'PLANETZ_BUNDLED_TAKT_ROOT'
const PREVIOUS_BUNDLED_ROOT = process.env[BUNDLED_TAKT_ROOT_ENV]

async function createBundledCliFixture(script: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'bundled-takt-'))
  const cliDir = join(root, 'dist', 'app', 'cli')
  await mkdir(cliDir, { recursive: true })
  await writeFile(join(cliDir, 'index.js'), script, 'utf8')
  await writeFile(join(root, 'package.json'), '{}\n', 'utf8')
  await mkdir(join(root, 'node_modules'), { recursive: true })
  return root
}

describe('exec-cli', () => {
  afterEach(() => {
    execaMock.mockClear()
    lookupNodeBinaryOnPathMock.mockReset()
    lookupNodeBinaryOnPathMock.mockReturnValue(null)
    if (PREVIOUS_BUNDLED_ROOT === undefined) {
      delete process.env[BUNDLED_TAKT_ROOT_ENV]
    } else {
      process.env[BUNDLED_TAKT_ROOT_ENV] = PREVIOUS_BUNDLED_ROOT
    }
  })

  it('resolves bundled takt cli path and forwards args', async () => {
    const root = await createBundledCliFixture('process.exit(0)\n')
    process.env[BUNDLED_TAKT_ROOT_ENV] = root

    const command = resolveTaktCliCommand(DEFAULT_CONFIG, ['list', '--format', 'json'])
    expect(command.file).toBe(process.execPath)
    expect(command.args).toEqual([
      join(root, 'dist', 'app', 'cli', 'index.js'),
      'list',
      '--format',
      'json',
    ])
  })

  it('uses npm_node_execpath when hosted in Electron and path is Node', () => {
    const savedElectron = process.versions.electron
    const savedNpmNode = process.env.npm_node_execpath
    const savedNodeBinary = process.env.PLANETZ_NODE_BINARY
    try {
      Object.assign(process.versions, { electron: '41.7.0' })
      delete process.env.PLANETZ_NODE_BINARY
      process.env.npm_node_execpath = process.execPath
      expect(resolveTaktCliRunnerBinary()).toBe(process.execPath)
    } finally {
      if (savedElectron === undefined) {
        delete (process.versions as { electron?: string }).electron
      } else {
        Object.assign(process.versions, { electron: savedElectron })
      }
      if (savedNpmNode === undefined) {
        delete process.env.npm_node_execpath
      } else {
        process.env.npm_node_execpath = savedNpmNode
      }
      if (savedNodeBinary === undefined) {
        delete process.env.PLANETZ_NODE_BINARY
      } else {
        process.env.PLANETZ_NODE_BINARY = savedNodeBinary
      }
    }
  })

  it('rejects PLANETZ_NODE_BINARY when it points at an Electron binary', () => {
    const savedElectron = process.versions.electron
    const savedNodeBinary = process.env.PLANETZ_NODE_BINARY
    const savedNpmNode = process.env.npm_node_execpath
    try {
      Object.assign(process.versions, { electron: '41.7.0' })
      delete process.env.npm_node_execpath
      process.env.PLANETZ_NODE_BINARY = '/Applications/Planetz.app/Contents/MacOS/Electron'
      lookupNodeBinaryOnPathMock.mockReturnValue(process.execPath)
      expect(resolveTaktCliRunnerBinary()).toBe(process.execPath)
    } finally {
      if (savedElectron === undefined) {
        delete (process.versions as { electron?: string }).electron
      } else {
        Object.assign(process.versions, { electron: savedElectron })
      }
      if (savedNpmNode === undefined) {
        delete process.env.npm_node_execpath
      } else {
        process.env.npm_node_execpath = savedNpmNode
      }
      if (savedNodeBinary === undefined) {
        delete process.env.PLANETZ_NODE_BINARY
      } else {
        process.env.PLANETZ_NODE_BINARY = savedNodeBinary
      }
    }
  })

  it('rejects npm_node_execpath when it points at an Electron binary', () => {
    const savedElectron = process.versions.electron
    const savedNpmNode = process.env.npm_node_execpath
    const savedNodeBinary = process.env.PLANETZ_NODE_BINARY
    try {
      Object.assign(process.versions, { electron: '41.7.0' })
      delete process.env.PLANETZ_NODE_BINARY
      process.env.npm_node_execpath = '/Applications/Planetz.app/Contents/MacOS/Electron'
      lookupNodeBinaryOnPathMock.mockReturnValue(process.execPath)
      expect(resolveTaktCliRunnerBinary()).toBe(process.execPath)
    } finally {
      if (savedElectron === undefined) {
        delete (process.versions as { electron?: string }).electron
      } else {
        Object.assign(process.versions, { electron: savedElectron })
      }
      if (savedNpmNode === undefined) {
        delete process.env.npm_node_execpath
      } else {
        process.env.npm_node_execpath = savedNpmNode
      }
      if (savedNodeBinary === undefined) {
        delete process.env.PLANETZ_NODE_BINARY
      } else {
        process.env.PLANETZ_NODE_BINARY = savedNodeBinary
      }
    }
  })

  it('prefers PLANETZ_NODE_BINARY over npm_node_execpath when both are Node', () => {
    const savedElectron = process.versions.electron
    const savedNpmNode = process.env.npm_node_execpath
    const savedNodeBinary = process.env.PLANETZ_NODE_BINARY
    try {
      Object.assign(process.versions, { electron: '41.7.0' })
      process.env.npm_node_execpath = process.execPath
      process.env.PLANETZ_NODE_BINARY = process.execPath
      expect(resolveTaktCliRunnerBinary()).toBe(process.execPath)
    } finally {
      if (savedElectron === undefined) {
        delete (process.versions as { electron?: string }).electron
      } else {
        Object.assign(process.versions, { electron: savedElectron })
      }
      if (savedNpmNode === undefined) {
        delete process.env.npm_node_execpath
      } else {
        process.env.npm_node_execpath = savedNpmNode
      }
      if (savedNodeBinary === undefined) {
        delete process.env.PLANETZ_NODE_BINARY
      } else {
        process.env.PLANETZ_NODE_BINARY = savedNodeBinary
      }
    }
  })

  it('throws NodeRunnerBinaryNotFoundError when no usable Node binary exists', () => {
    const savedElectron = process.versions.electron
    const savedNpmNode = process.env.npm_node_execpath
    const savedNodeBinary = process.env.PLANETZ_NODE_BINARY
    try {
      Object.assign(process.versions, { electron: '41.7.0' })
      delete process.env.PLANETZ_NODE_BINARY
      process.env.npm_node_execpath = '/Applications/Planetz.app/Contents/MacOS/Electron'
      lookupNodeBinaryOnPathMock.mockReturnValue(null)
      expect(() => resolveTaktCliRunnerBinary()).toThrow(NodeRunnerBinaryNotFoundError)
    } finally {
      if (savedElectron === undefined) {
        delete (process.versions as { electron?: string }).electron
      } else {
        Object.assign(process.versions, { electron: savedElectron })
      }
      if (savedNpmNode === undefined) {
        delete process.env.npm_node_execpath
      } else {
        process.env.npm_node_execpath = savedNpmNode
      }
      if (savedNodeBinary === undefined) {
        delete process.env.PLANETZ_NODE_BINARY
      } else {
        process.env.PLANETZ_NODE_BINARY = savedNodeBinary
      }
    }
  })

  it('defaults bundled takt stdin to ignore so non-TTY confirm prompts do not block', async () => {
    const root = await createBundledCliFixture('process.exit(0)\n')
    process.env[BUNDLED_TAKT_ROOT_ENV] = root

    await runTaktCli(DEFAULT_CONFIG, ['add', 'probe'])

    expect(execaMock).toHaveBeenCalledWith(
      process.execPath,
      [join(root, 'dist', 'app', 'cli', 'index.js'), 'add', 'probe'],
      expect.objectContaining({ stdin: 'ignore' }),
    )
  })

  it('normalizes output text shapes from execa', () => {
    expect(outputText('hello')).toBe('hello')
    expect(outputText(new Uint8Array([104, 105]))).toBe('hi')
    expect(outputText(['a', 2, true])).toBe('a\n2\ntrue')
    expect(outputText(null)).toBe('')
  })
})
