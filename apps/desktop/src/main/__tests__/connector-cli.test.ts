import type { UiConfig } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionProfileContext } from '../planetz/execution-profile-context.js'

vi.mock('../lib/tasks-yaml-takt-compat.js', () => ({
  sanitizeTasksYamlForTakt: vi.fn(async () => {}),
}))

vi.mock('../takt/exec-cli.js', () => ({
  outputText: (value: unknown) => {
    if (typeof value === 'string') return value
    if (value == null) return ''
    return String(value)
  },
  runTaktCli: vi.fn(),
}))

vi.mock('../takt/task-package-writer.js', () => ({
  TaskPackageWriter: vi.fn().mockImplementation(() => ({
    createPackage: vi.fn(async () => ({
      taskId: 'pkg-fallback',
      taskDir: '.takt/tasks/pkg-fallback',
    })),
  })),
}))

vi.mock('../lib/tasks-yaml-reader.js', () => ({
  readTasksFromYaml: vi.fn(async () => [{ id: 'new-task' }]),
}))

import { sanitizeTasksYamlForTakt } from '../lib/tasks-yaml-takt-compat.js'
import { isMisroutedTaktAddResult, TaktConnectorCli } from '../takt/connector-cli.js'
import { runTaktCli } from '../takt/exec-cli.js'
import { TaktAddEnqueueError } from '../takt/takt-add-enqueue-error.js'
import { TaskPackageWriter } from '../takt/task-package-writer.js'

const CONFIG = {} as UiConfig

function createExecutionProfileContext(): ExecutionProfileContext {
  return {
    loadEngineConfig: async () => ({}),
    resolveWorkflowForRuntime: async () => ({
      workflow: 'default',
      yaml: 'name: default\n',
    }),
    buildRuntimeEnv: async () => ({}),
  }
}

describe('isMisroutedTaktAddResult', () => {
  it('detects interactive-mode stdout from a zero exit code', () => {
    expect(
      isMisroutedTaktAddResult({
        exitCode: 0,
        stdout: 'Select interactive mode:\n',
        stderr: '',
      }),
    ).toBe(true)
  })

  it('returns false for a real add success line', () => {
    expect(
      isMisroutedTaktAddResult({
        exitCode: 0,
        stdout: 'Task created: demo\n',
        stderr: '',
      }),
    ).toBe(false)
  })
})

describe('TaktConnectorCli.enqueueTask', () => {
  beforeEach(() => {
    vi.mocked(runTaktCli).mockReset()
    vi.mocked(sanitizeTasksYamlForTakt).mockClear()
    vi.mocked(TaskPackageWriter).mockClear()
    delete process.env.PLANETZ_ENQUEUE_MODE
    delete process.env.PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK
  })

  it('uses takt add by default', async () => {
    const text = 'issue #23 を実装して'
    vi.mocked(runTaktCli).mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'Task created: demo\n',
      stderr: '',
    } as never)
    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    await connector.enqueueTask({ title: text, body: text }, new Set())

    expect(vi.mocked(runTaktCli).mock.calls[0]?.[1]).toEqual([
      'add',
      '--workflow',
      'default',
      '--',
      text,
    ])
    expect(vi.mocked(TaskPackageWriter)).not.toHaveBeenCalled()
    expect(vi.mocked(sanitizeTasksYamlForTakt)).toHaveBeenCalledTimes(2)
  })

  it('uses task package writer when PLANETZ_ENQUEUE_MODE is package_writer', async () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'package_writer'
    const text = 'issue #23 を実装して'
    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    const result = await connector.enqueueTask({ title: text, body: text }, new Set())

    expect(result.taskId).toBe('pkg-fallback')
    expect(runTaktCli).not.toHaveBeenCalled()
    expect(vi.mocked(TaskPackageWriter)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sanitizeTasksYamlForTakt)).toHaveBeenCalledTimes(1)
  })

  it('rejects enqueue when takt add misroutes to interactive mode without fallback env', async () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'takt_add'
    vi.mocked(runTaktCli).mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'Select interactive mode:\n',
      stderr: '',
    } as never)

    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    await expect(
      connector.enqueueTask({ title: 'New task', body: 'Do work' }, new Set(['existing'])),
    ).rejects.toBeInstanceOf(TaktAddEnqueueError)
    expect(runTaktCli).toHaveBeenCalledTimes(1)
    expect(vi.mocked(TaskPackageWriter)).not.toHaveBeenCalled()
  })

  it('falls back to task package writer when misrouted and PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK=1', async () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'takt_add'
    process.env.PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK = '1'
    vi.mocked(runTaktCli).mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'Select interactive mode:\n',
      stderr: '',
    } as never)

    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    const result = await connector.enqueueTask(
      { title: 'New task', body: 'Do work' },
      new Set(['existing']),
    )
    expect(result.taskId).toBe('pkg-fallback')
    expect(runTaktCli).toHaveBeenCalledTimes(1)
    expect(vi.mocked(TaskPackageWriter)).toHaveBeenCalledTimes(1)
  })
})

function mockDetachedSubprocess(
  exit: Promise<{ exitCode: number; stdout: string; stderr: string }>,
): ReturnType<typeof runTaktCli> {
  const subprocess = {
    pid: 42_001,
    unref: vi.fn(),
    on: vi.fn(),
    catch: vi.fn((handler: (error: unknown) => void) => {
      void exit.catch(handler)
      return subprocess
    }),
    // Intentional thenable stub for detached subprocess mocks.
    // biome-ignore lint/suspicious/noThenProperty: mirrors promise-like CLI handle under test
    then: exit.then.bind(exit),
  }
  return subprocess as unknown as ReturnType<typeof runTaktCli>
}

describe('TaktConnectorCli.runTaskNow', () => {
  beforeEach(() => {
    vi.mocked(runTaktCli).mockReset()
  })

  it('spawns detached takt run and returns without awaiting workflow completion', async () => {
    vi.mocked(runTaktCli).mockReturnValue(
      mockDetachedSubprocess(Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })),
    )

    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    await connector.runTaskNow({
      title: 'Implement task',
      provider: 'cursor',
      model: 'gpt-5',
    })

    expect(runTaktCli).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runTaktCli).mock.calls[0]?.[2]).toMatchObject({
      detached: true,
      stdio: 'ignore',
    })
    expect(vi.mocked(runTaktCli).mock.calls[0]?.[1]).toEqual([
      '--provider',
      'cursor',
      '--model',
      'gpt-5',
      'run',
    ])
  })

  it('retries with Cursor auto in the background when free-plan named-model restriction is returned', async () => {
    vi.mocked(runTaktCli)
      .mockReturnValueOnce(
        mockDetachedSubprocess(
          Promise.resolve({
            exitCode: 1,
            stdout: '',
            stderr:
              'S: Named models unavailable Free plans can only use Auto. Switch to Auto or upgrade plans to continue.',
          }),
        ),
      )
      .mockReturnValueOnce(
        mockDetachedSubprocess(Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })),
      )

    const connector = new TaktConnectorCli(
      '/tmp/workspace',
      CONFIG,
      createExecutionProfileContext(),
    )
    await connector.runTaskNow({
      title: 'Implement task',
      provider: 'cursor',
      model: 'gpt-5',
    })
    await vi.waitFor(() => expect(runTaktCli).toHaveBeenCalledTimes(2))

    expect(vi.mocked(runTaktCli).mock.calls[1]?.[1]).toEqual([
      '--provider',
      'cursor',
      '--model',
      'auto',
      'run',
    ])
  })
})
