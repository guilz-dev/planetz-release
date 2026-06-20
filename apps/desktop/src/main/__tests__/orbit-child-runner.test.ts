import { headlessInteractiveUnavailableMessage } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'

const logRunnerSpawnTraceMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/runner-spawn-trace.js', () => ({
  logRunnerSpawnTrace: logRunnerSpawnTraceMock,
  isRunnerSpawnTraceEnabled: vi.fn(() => true),
}))

const resolveTaktCliRunnerBinaryMock = vi.hoisted(() => vi.fn(() => '/usr/local/bin/node'))

vi.mock('../takt/exec-cli.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../takt/exec-cli.js')>()
  return {
    ...actual,
    resolveTaktCliRunnerBinary: resolveTaktCliRunnerBinaryMock,
    NodeRunnerBinaryNotFoundError: actual.NodeRunnerBinaryNotFoundError,
  }
})

import {
  buildOrbitChildRunnerEnv,
  resolveOrbitChildRunnerBinary,
  traceOrbitChildRunnerSpawn,
} from '../lib/orbit-child-runner.js'
import { NodeRunnerBinaryNotFoundError } from '../takt/exec-cli.js'

describe('orbit-child-runner', () => {
  it('wraps NodeRunnerBinaryNotFoundError with headlessInteractiveUnavailableMessage', () => {
    resolveTaktCliRunnerBinaryMock.mockImplementation(() => {
      throw new NodeRunnerBinaryNotFoundError()
    })
    expect(() => resolveOrbitChildRunnerBinary()).toThrow(
      headlessInteractiveUnavailableMessage(
        'Could not resolve a Node binary for bundled takt/orbit runners.',
      ),
    )
  })

  it('sets ELECTRON_RUN_AS_NODE only for Electron runner binaries', () => {
    const nodeEnv = buildOrbitChildRunnerEnv('/usr/local/bin/node', {
      PLANETZ_ORBIT_MODULE_ROOT: '/orbit',
    })
    expect(nodeEnv.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(nodeEnv.PLANETZ_ORBIT_MODULE_ROOT).toBe('/orbit')

    const electronEnv = buildOrbitChildRunnerEnv(
      '/Applications/Planetz.app/Contents/MacOS/Electron',
      {},
    )
    expect(electronEnv.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('forwards trace details to runner-spawn-trace', () => {
    logRunnerSpawnTraceMock.mockClear()
    traceOrbitChildRunnerSpawn(
      'composer-orbit-llm-runner',
      { runnerBinary: '/usr/local/bin/node' },
      { pid: 99 },
    )
    expect(logRunnerSpawnTraceMock).toHaveBeenCalledWith('composer-orbit-llm-runner', {
      runnerBinary: '/usr/local/bin/node',
      pid: 99,
    })
  })
})
