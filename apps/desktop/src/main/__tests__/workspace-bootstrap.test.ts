import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { orbitRootPath, PLANETZ_ENGINE_CONFIG_FILENAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { classifyWorkspaceBootstrap } from '../lib/workspace-bootstrap.js'

function makeWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'planetz-test-'))
}

describe('classifyWorkspaceBootstrap', () => {
  const workspaces: string[] = []

  afterEach(() => {
    for (const dir of workspaces) {
      rmSync(dir, { recursive: true, force: true })
    }
    workspaces.length = 0
  })

  it('returns non_takt when sidecar root is missing', () => {
    const ws = makeWorkspace()
    workspaces.push(ws)
    expect(classifyWorkspaceBootstrap(ws)).toBe('non_takt')
  })

  it('returns partial_takt when engine-config.yaml is missing', () => {
    const ws = makeWorkspace()
    workspaces.push(ws)
    mkdirSync(orbitRootPath(ws), { recursive: true })
    expect(classifyWorkspaceBootstrap(ws)).toBe('partial_takt')
  })

  it('returns partial_takt when engine-config.yaml is invalid', () => {
    const ws = makeWorkspace()
    workspaces.push(ws)
    mkdirSync(orbitRootPath(ws), { recursive: true })
    writeFileSync(join(orbitRootPath(ws), PLANETZ_ENGINE_CONFIG_FILENAME), 'not: valid\n', 'utf8')
    expect(classifyWorkspaceBootstrap(ws)).toBe('partial_takt')
  })

  it('returns partial_takt when provider/model defaults are missing', () => {
    const ws = makeWorkspace()
    workspaces.push(ws)
    mkdirSync(orbitRootPath(ws), { recursive: true })
    writeFileSync(join(orbitRootPath(ws), PLANETZ_ENGINE_CONFIG_FILENAME), '{}\n', 'utf8')
    expect(classifyWorkspaceBootstrap(ws)).toBe('partial_takt')
  })

  it('returns takt_ready when provider/model defaults are configured', () => {
    const ws = makeWorkspace()
    workspaces.push(ws)
    mkdirSync(orbitRootPath(ws), { recursive: true })
    writeFileSync(
      join(orbitRootPath(ws), PLANETZ_ENGINE_CONFIG_FILENAME),
      'provider: cursor\nmodel: auto\n',
      'utf8',
    )
    expect(classifyWorkspaceBootstrap(ws)).toBe('takt_ready')
  })
})
