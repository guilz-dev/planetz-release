import { EventEmitter } from 'node:events'
import {
  ORBIT_INTERACTIVE_CONTRACT_VERSION,
  type OrbitInteractiveResponse,
  type OrbitInteractiveSnapshot,
} from '@planetz/shared'
import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { orbitTestRoot } = vi.hoisted(() => ({
  orbitTestRoot: '/tmp/planetz-orbit-interactive-test-root',
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('../../takt/exec-cli.js', () => ({
  candidateBundledOrbitRoots: () => [orbitTestRoot],
  resolveRunnableBundledOrbitRoot: () => orbitTestRoot,
}))

vi.mock('../../lib/orbit-child-runner.js', () => ({
  resolveOrbitChildRunnerBinary: () => '/usr/bin/node',
  buildOrbitChildRunnerEnv: (
    _binary: string,
    extras: Record<string, string | undefined>,
  ): Record<string, string> => ({
    ...process.env,
    ...Object.fromEntries(
      Object.entries(extras).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  }),
  traceOrbitChildRunnerSpawn: () => {},
}))

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>()
  return {
    ...mod,
    existsSync: () => true,
  }
})

import {
  assertOrbitInteractiveOk,
  orbitInteractiveStart,
  orbitInteractiveTurn,
} from '../../planetz/orbit-interactive-client.js'

function baseResponse(
  result: NonNullable<OrbitInteractiveResponse['result']>,
): OrbitInteractiveResponse {
  return {
    contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
    ok: true,
    result,
    nextSnapshot: null,
  }
}

function buildSnapshot(): OrbitInteractiveSnapshot {
  return {
    planetzSessionId: 'composer_test',
    cwd: '/tmp/workspace',
    workflowId: 'default',
    provider: 'claude',
    lang: 'en',
    messages: [],
    workflowContext: { name: 'default' },
    systemPrompt: 'system',
    allowedTools: ['Read'],
    updatedAt: new Date().toISOString(),
  }
}

describe('orbitInteractiveStart', () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset()
  })

  it('forwards sessionPolicy and toolsProfile in start payload', async () => {
    vi.mocked(execa).mockResolvedValueOnce({
      stdout: JSON.stringify({
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: buildSnapshot(),
      }),
    } as never)

    await orbitInteractiveStart({
      cwd: '/tmp/workspace',
      workflow: 'chat-investigation',
      planetzSessionId: 'composer_policy',
      provider: 'claude',
      sessionPolicy: 'planetz-chat-investigate',
      toolsProfile: 'readonly',
    })

    const call = vi.mocked(execa).mock.calls[0]
    const execaOptions = ((call as unknown as unknown[])?.[2] ?? {}) as { input?: string }
    const stdinPayload = JSON.parse(String(execaOptions.input))
    expect(stdinPayload.payload.sessionPolicy).toBe('planetz-chat-investigate')
    expect(stdinPayload.payload.toolsProfile).toBe('readonly')
  })
})

describe('assertOrbitInteractiveOk', () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset()
  })

  it('keeps low-signal Claude CLI failure messages as-is', () => {
    const response = baseResponse({
      kind: 'error',
      error: 'Claude CLI failed (1): Claude CLI exited with code 1',
    })
    expect(() => assertOrbitInteractiveOk(response)).toThrowError(
      /Claude CLI failed \(1\): Claude CLI exited with code 1/,
    )
  })

  it('keeps non-Claude errors as-is', () => {
    const response = baseResponse({
      kind: 'error',
      error: 'validation failed',
    })
    expect(() => assertOrbitInteractiveOk(response)).toThrowError(/validation failed/)
  })

  it('keeps invokeRunner catch messages as-is for low-signal failures', async () => {
    vi.mocked(execa).mockRejectedValueOnce(
      new Error('Claude CLI failed (1): Claude CLI exited with code 1'),
    )
    await expect(orbitInteractiveTurn(buildSnapshot(), 'hello')).rejects.toThrowError(
      /Claude CLI failed \(1\): Claude CLI exited with code 1/,
    )
  })

  it('keeps invokeRunner catch messages as-is for signal-terminated failures', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('Claude CLI terminated by signal SIGTERM'))
    await expect(orbitInteractiveTurn(buildSnapshot(), 'hello')).rejects.toThrowError(
      /Claude CLI terminated by signal SIGTERM/,
    )
  })

  it('uses the longer process timeout for streaming interactive turns', async () => {
    const stderr = new EventEmitter()
    const subprocess = Object.assign(
      Promise.resolve(
        JSON.stringify(
          baseResponse({
            kind: 'assistant_message',
            assistantMessage: 'done',
          }),
        ),
      ).then((stdout) => ({ stdout })),
      { stderr },
    )
    vi.mocked(execa).mockReturnValueOnce(subprocess as never)

    await orbitInteractiveTurn(buildSnapshot(), 'hello', { onStreamLine: vi.fn() })

    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ timeout: 30 * 60_000 }),
    )
  })
})
