import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ORBIT_RUNTIME_WORKFLOWS_DIRNAME,
  ORBIT_TAKT_GLOBAL_DIRNAME,
  PLANETZ_WORKFLOWS_DIRNAME,
  type TaskViewModel,
} from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { taktGlobalWorkflowsDir } from '../planetz/takt-runtime-adapter.js'
import {
  collectReferencedRuntimeWorkflowNames,
  gcOrphanRuntimeWorkflowFiles,
} from '../session/workflow-selection/runtime-workflow-gc.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.map((root) => rm(root, { recursive: true, force: true })))
  tempDirs.length = 0
})

function sidecarPaths(root: string): SidecarPaths {
  return { root, isWorkspaceLocal: false } as SidecarPaths
}

async function makeSidecarRoot(): Promise<string> {
  const root = join(
    tmpdir(),
    `planetz-runtime-gc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  tempDirs.push(root)
  await mkdir(join(root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME), { recursive: true })
  await mkdir(join(root, ORBIT_TAKT_GLOBAL_DIRNAME, PLANETZ_WORKFLOWS_DIRNAME), { recursive: true })
  return root
}

function task(workflow: string, status: TaskViewModel['status'] = 'pending'): TaskViewModel {
  return {
    id: `task-${workflow}`,
    title: workflow,
    priority: 'normal',
    status,
    source: 'takt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow,
  }
}

describe('runtime-workflow-gc', () => {
  it('collects referenced runtime workflow names from tasks', () => {
    const referenced = collectReferencedRuntimeWorkflowNames([
      task('default'),
      task('default__modified-rt-a1b2c3d4'),
    ])
    expect([...referenced]).toEqual(['default__modified-rt-a1b2c3d4'])
  })

  it('removes orphan runtime workflow files while keeping referenced ones', async () => {
    const root = await makeSidecarRoot()
    const paths = sidecarPaths(root)
    const runtimeDir = join(root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME)
    const taktGlobalDir = taktGlobalWorkflowsDir(paths)
    await writeFile(
      join(runtimeDir, 'default__modified-rt-11111111.yaml'),
      'name: default\nsteps: []',
    )
    await writeFile(
      join(runtimeDir, 'default__modified-rt-22222222.yaml'),
      'name: default\nsteps: []',
    )
    await writeFile(join(runtimeDir, 'default.yaml'), 'name: default\nsteps: []')
    await writeFile(
      join(taktGlobalDir, 'default__modified-rt-22222222.yaml'),
      'name: default\nsteps: []',
    )

    const referenced = new Set(['default__modified-rt-11111111'])
    const removed = await gcOrphanRuntimeWorkflowFiles(paths, referenced)

    expect(removed).toBe(1)
    await expect(
      readFile(join(runtimeDir, 'default__modified-rt-11111111.yaml'), 'utf8'),
    ).resolves.toBeTruthy()
    await expect(
      readFile(join(runtimeDir, 'default__modified-rt-22222222.yaml'), 'utf8'),
    ).rejects.toThrow()
    await expect(
      readFile(join(taktGlobalDir, 'default__modified-rt-22222222.yaml'), 'utf8'),
    ).rejects.toThrow()
    await expect(readFile(join(runtimeDir, 'default.yaml'), 'utf8')).resolves.toBeTruthy()
  })

  it('removes takt-global mirror orphans when sidecar runtime file is already gone', async () => {
    const root = await makeSidecarRoot()
    const paths = sidecarPaths(root)
    const taktGlobalDir = taktGlobalWorkflowsDir(paths)
    await writeFile(
      join(taktGlobalDir, 'default__modified-rt-33333333.yaml'),
      'name: default\nsteps: []',
    )

    const removed = await gcOrphanRuntimeWorkflowFiles(paths, new Set())

    expect(removed).toBe(1)
    await expect(
      access(join(taktGlobalDir, 'default__modified-rt-33333333.yaml')),
    ).rejects.toThrow()
  })
})
