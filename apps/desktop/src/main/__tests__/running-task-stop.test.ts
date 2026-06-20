import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as processAlive from '../lib/process-alive.js'
import {
  FORCE_FAIL_USER_MESSAGE,
  forceFailRunningTask,
  reconcileStaleRunningAfterStop,
  resolveRunningTaskOwnerPid,
  stopProcessGracefully,
} from '../lib/running-task-stop.js'

const config = {
  ...DEFAULT_CONFIG,
  tasksYamlPath: '.takt/tasks.yaml',
}

describe('running-task-stop', () => {
  const dirs: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    dirs.length = 0
  })

  function seedRepo(tasksYaml: string): string {
    const root = mkdtempSync(join(tmpdir(), 'planetz-running-task-stop-'))
    dirs.push(root)
    mkdirSync(join(root, '.takt'), { recursive: true })
    writeFileSync(join(root, '.takt', 'tasks.yaml'), tasksYaml, 'utf8')
    return root
  }

  describe('resolveRunningTaskOwnerPid', () => {
    it('returns pid for running task with owner_pid', async () => {
      const repo = seedRepo(`tasks:
  - name: task-a
    status: running
    owner_pid: 4242
`)
      const result = await resolveRunningTaskOwnerPid(repo, config, 'task-a')
      expect(result).toEqual({ kind: 'ok', pid: 4242 })
    })

    it('matches running status case-insensitively', async () => {
      const repo = seedRepo(`tasks:
  - name: task-a
    status: Running
    owner_pid: 99
`)
      const result = await resolveRunningTaskOwnerPid(repo, config, 'task-a')
      expect(result).toEqual({ kind: 'ok', pid: 99 })
    })

    it('returns no_owner_pid when owner_pid is missing', async () => {
      const repo = seedRepo(`tasks:
  - name: task-a
    status: running
`)
      const result = await resolveRunningTaskOwnerPid(repo, config, 'task-a')
      expect(result).toEqual({ kind: 'no_owner_pid' })
    })

    it('returns not_running when status is not running', async () => {
      const repo = seedRepo(`tasks:
  - name: task-a
    status: pending
    owner_pid: 1
`)
      const result = await resolveRunningTaskOwnerPid(repo, config, 'task-a')
      expect(result).toEqual({ kind: 'not_running' })
    })
  })

  describe('stopProcessGracefully', () => {
    beforeEach(() => {
      vi.spyOn(processAlive, 'isProcessAlive')
    })

    it('returns not_found when process is already dead', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
      vi.mocked(processAlive.isProcessAlive).mockReturnValue(false)
      await expect(stopProcessGracefully(1)).resolves.toBe('not_found')
      expect(killSpy).not.toHaveBeenCalled()
    })

    it('returns stopped after SIGINT when process exits', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
      vi.mocked(processAlive.isProcessAlive)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValue(false)

      await expect(stopProcessGracefully(42)).resolves.toBe('stopped')
      expect(killSpy).toHaveBeenCalledWith(42, 'SIGINT')
      expect(killSpy).not.toHaveBeenCalledWith(42, 'SIGTERM')
    })

    it('escalates SIGINT to SIGTERM to SIGKILL when process stays alive', async () => {
      vi.useFakeTimers()
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
      vi.mocked(processAlive.isProcessAlive).mockReturnValue(true)

      const resultPromise = stopProcessGracefully(42)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toBe('timeout')
      expect(killSpy).toHaveBeenCalledWith(42, 'SIGINT')
      expect(killSpy).toHaveBeenCalledWith(42, 'SIGTERM')
      expect(killSpy).toHaveBeenCalledWith(42, 'SIGKILL')
      vi.useRealTimers()
    })

    it('returns not_found when kill throws ESRCH', async () => {
      vi.mocked(processAlive.isProcessAlive).mockReturnValue(true)
      vi.spyOn(process, 'kill').mockImplementation(() => {
        const error = new Error('no such process') as NodeJS.ErrnoException
        error.code = 'ESRCH'
        throw error
      })
      await expect(stopProcessGracefully(42)).resolves.toBe('not_found')
    })
  })

  describe('forceFailRunningTask', () => {
    it('writes failed status with failure.error and removes owner_pid', async () => {
      const repo = seedRepo(`tasks:
  - name: task-a
    status: running
    owner_pid: 1
    started_at: 2026-05-29T10:00:00.000Z
`)
      const changed = await forceFailRunningTask(repo, config, 'task-a', FORCE_FAIL_USER_MESSAGE)
      expect(changed).toBe(true)
      const raw = readFileSync(join(repo, '.takt', 'tasks.yaml'), 'utf8')
      expect(raw).toContain('status: failed')
      expect(raw).toContain(`error: ${FORCE_FAIL_USER_MESSAGE}`)
      expect(raw).not.toContain('owner_pid')
      expect(raw).toContain('completed_at:')
      expect(raw).toContain('started_at:')
    })
  })

  describe('reconcileStaleRunningAfterStop', () => {
    it('force-fails when process is dead and task stays running', async () => {
      vi.spyOn(processAlive, 'isProcessAlive').mockReturnValue(false)
      const repo = seedRepo(`tasks:
  - name: task-a
    status: running
    owner_pid: 1
`)
      const readFresh = vi.fn().mockResolvedValue([
        {
          id: 'task-a',
          title: 'task-a',
          priority: 'normal',
          status: 'running',
          source: 'takt',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      vi.useFakeTimers()
      const reconcilePromise = reconcileStaleRunningAfterStop(repo, config, 'task-a', 1, readFresh)
      await vi.runAllTimersAsync()
      const forceFailed = await reconcilePromise
      vi.useRealTimers()

      expect(forceFailed).toBe(true)
      const raw = readFileSync(join(repo, '.takt', 'tasks.yaml'), 'utf8')
      expect(raw).toContain('status: failed')
    })

    it('returns false when process is still alive', async () => {
      vi.spyOn(processAlive, 'isProcessAlive').mockReturnValue(true)
      const repo = seedRepo(`tasks:
  - name: task-a
    status: running
    owner_pid: 1
`)
      const forceFailed = await reconcileStaleRunningAfterStop(
        repo,
        config,
        'task-a',
        1,
        async () => [],
      )
      expect(forceFailed).toBe(false)
    })
  })
})
