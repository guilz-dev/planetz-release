import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyPackagedNodeBinaryEnv,
  resolvePackagedNodeBinaryPath,
} from '../packaged-node-binary.js'

describe('packaged-node-binary', () => {
  let previousNodeBinary: string | undefined

  beforeEach(() => {
    previousNodeBinary = process.env.PLANETZ_NODE_BINARY
    delete process.env.PLANETZ_NODE_BINARY
  })

  afterEach(() => {
    if (previousNodeBinary === undefined) delete process.env.PLANETZ_NODE_BINARY
    else process.env.PLANETZ_NODE_BINARY = previousNodeBinary
  })

  it('resolvePackagedNodeBinaryPath joins resourcesPath with bundled node layout', () => {
    expect(resolvePackagedNodeBinaryPath('/tmp/Resources')).toBe('/tmp/Resources/node/bin/node')
  })

  it('sets PLANETZ_NODE_BINARY when packaged and bundled node exists', () => {
    const resources = mkdtempSync(join(tmpdir(), 'planetz-packaged-node-'))
    const nodePath = resolvePackagedNodeBinaryPath(resources)
    mkdirSync(join(resources, 'node', 'bin'), { recursive: true })
    writeFileSync(nodePath, '')

    const env: NodeJS.ProcessEnv = {}
    applyPackagedNodeBinaryEnv({
      isPackaged: true,
      resourcesPath: resources,
      env,
    })

    expect(env.PLANETZ_NODE_BINARY).toBe(nodePath)
  })

  it('does not override an existing PLANETZ_NODE_BINARY', () => {
    const resources = mkdtempSync(join(tmpdir(), 'planetz-packaged-node-'))
    const nodePath = resolvePackagedNodeBinaryPath(resources)
    mkdirSync(join(resources, 'node', 'bin'), { recursive: true })
    writeFileSync(nodePath, '')

    const env: NodeJS.ProcessEnv = { PLANETZ_NODE_BINARY: '/custom/node' }
    applyPackagedNodeBinaryEnv({
      isPackaged: true,
      resourcesPath: resources,
      env,
    })

    expect(env.PLANETZ_NODE_BINARY).toBe('/custom/node')
  })

  it('skips when not packaged', () => {
    const resources = mkdtempSync(join(tmpdir(), 'planetz-packaged-node-'))
    const nodePath = resolvePackagedNodeBinaryPath(resources)
    mkdirSync(join(resources, 'node', 'bin'), { recursive: true })
    writeFileSync(nodePath, '')

    const env: NodeJS.ProcessEnv = {}
    applyPackagedNodeBinaryEnv({
      isPackaged: false,
      resourcesPath: resources,
      env,
    })

    expect(env.PLANETZ_NODE_BINARY).toBeUndefined()
  })
})
