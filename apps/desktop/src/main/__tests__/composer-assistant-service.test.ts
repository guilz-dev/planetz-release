import {
  COMPOSER_ASSISTANT_MAX_TURNS,
  COMPOSER_CONTEXT_TOO_LARGE_SNIPPET,
  COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET,
  type ComposerAssistSessionSnapshot,
  ORBIT_INTERACTIVE_CONTRACT_VERSION,
  type OrbitInteractiveSnapshot,
} from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  orbitInteractiveAccept,
  orbitInteractiveFinalize,
  orbitInteractivePlay,
  orbitInteractiveStart,
  orbitInteractiveTurn,
} from '../planetz/orbit-interactive-client.js'
import {
  ComposerAssistantService,
  ComposerSessionNotFoundError,
} from '../session/composer-assistant-service.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

vi.mock('../planetz/orbit-interactive-client.js', () => ({
  orbitInteractiveStart: vi.fn(),
  orbitInteractiveTurn: vi.fn(),
  orbitInteractiveFinalize: vi.fn(),
  orbitInteractiveAccept: vi.fn(),
  orbitInteractivePlay: vi.fn(),
  orbitInteractiveCancel: vi.fn(),
  assertOrbitInteractiveOk: (response: {
    ok: boolean
    result?: { kind: string; error?: string }
    error?: string
  }) => {
    if (!response.result) {
      throw new Error(response.error ?? 'Headless interactive request failed')
    }
    if (response.result.kind === 'error') {
      throw new Error(response.result.error ?? 'Headless interactive request failed')
    }
    if (!response.ok) {
      throw new Error(response.error ?? 'Headless interactive request failed')
    }
  },
  OrbitInteractiveClientError: class OrbitInteractiveClientError extends Error {
    readonly code = 'runner'
  },
}))

vi.mock('../planetz/composer-llm-client.js', () => ({
  askComposerAssistantTurn: vi.fn(async () => ({
    question: 'What is the target?',
    recommendedAnswer: 'Login form',
    readyToFinalize: false,
  })),
  finalizeComposerAssistant: vi.fn(async () => ({
    body: 'Fix the login form validation.',
  })),
  ComposerLlmTimeoutError: class ComposerLlmTimeoutError extends Error {
    readonly code = 'timeout'
  },
}))

function buildOrbitSnapshot(
  sessionId: string,
  messages: OrbitInteractiveSnapshot['messages'],
  options?: { sourceContext?: string; sessionPolicy?: OrbitInteractiveSnapshot['sessionPolicy'] },
): OrbitInteractiveSnapshot {
  return {
    planetzSessionId: sessionId,
    cwd: '/tmp/isolated-repo',
    workflowId: 'default',
    provider: 'mock',
    lang: 'en',
    messages,
    sourceContext: options?.sourceContext,
    workflowContext: { name: 'default' },
    systemPrompt: 'system',
    allowedTools: ['Read'],
    sessionPolicy: options?.sessionPolicy,
    updatedAt: new Date().toISOString(),
  }
}

describe('ComposerAssistantService', () => {
  const resolveExecutionProfile = vi.fn(async (input: { provider?: string; model?: string }) => ({
    provider: input.provider?.trim() || 'mock',
    model: input.model?.trim() || 'mock',
  }))
  const requireTaktRepoPath = vi.fn(() => '/tmp/isolated-repo')
  let persistedSnapshot: ComposerAssistSessionSnapshot | null = null
  const metrics: Array<{ phase: string; outcome: string }> = []

  beforeEach(() => {
    resolveExecutionProfile.mockClear()
    requireTaktRepoPath.mockClear()
    persistedSnapshot = null
    metrics.length = 0
    vi.mocked(orbitInteractiveStart).mockReset()
    vi.mocked(orbitInteractiveTurn).mockReset()
    vi.mocked(orbitInteractiveFinalize).mockReset()
    vi.mocked(orbitInteractiveAccept).mockReset()
    vi.mocked(orbitInteractivePlay).mockReset()
  })

  const loadEffectiveEngineConfig = vi.fn(async () => ({
    provider: 'mock',
    model: 'mock',
  }))

  function createService(options?: {
    createThreadOnStartSuccess?: ReturnType<typeof vi.fn>
    appendInteractiveMessage?: ReturnType<typeof vi.fn>
    findWorkspaceByActiveSessionId?: ReturnType<typeof vi.fn>
    emitComposerStream?: ReturnType<typeof vi.fn>
    resolveMcpServersForAgent?: ReturnType<typeof vi.fn>
    resolveMcpAllowedToolsForAgent?: ReturnType<typeof vi.fn>
    captureChatApplyBaseRef?: ReturnType<typeof vi.fn>
    registerChatApplySessionMeta?: ReturnType<typeof vi.fn>
  }) {
    const createThreadOnStartSuccess = options?.createThreadOnStartSuccess ?? vi.fn(async () => {})
    const appendInteractiveMessage = options?.appendInteractiveMessage ?? vi.fn(async () => {})
    const findWorkspaceByActiveSessionId =
      options?.findWorkspaceByActiveSessionId ?? vi.fn(async () => null)
    const emitComposerStream = options?.emitComposerStream
    const resolveMcpServersForAgent =
      options?.resolveMcpServersForAgent ?? vi.fn(async () => undefined)
    const resolveMcpAllowedToolsForAgent =
      options?.resolveMcpAllowedToolsForAgent ?? vi.fn(async () => undefined)

    return new ComposerAssistantService({
      resolveExecutionProfile,
      loadEffectiveEngineConfig,
      requireTaktRepoPath,
      requireIsolatedRepoPath: () => '/tmp/isolated',
      captureChatApplyBaseRef: options?.captureChatApplyBaseRef ?? vi.fn(async () => 'abc123'),
      registerChatApplySessionMeta: options?.registerChatApplySessionMeta ?? vi.fn(),
      unregisterChatApplySessionMeta: vi.fn(),
      resolveMcpServersForAgent,
      resolveMcpAllowedToolsForAgent,
      requireSidecarPaths: () =>
        ({
          sidecarDir: '/tmp/.orbit',
          sqlitePath: '/tmp/.orbit/planetz.db',
        }) as unknown as SidecarPaths,
      sessionStore: {
        load: vi.fn(async () => persistedSnapshot),
        save: vi.fn(async (_paths, snapshot) => {
          persistedSnapshot = snapshot
        }),
        clear: vi.fn(async () => {
          persistedSnapshot = null
        }),
      },
      metricsStore: {
        load: vi.fn(async () => ({
          startAttempts: 0,
          startSuccesses: 0,
          startTimeouts: 0,
          startErrors: 0,
          messageAttempts: 0,
          messageSuccesses: 0,
          messageTimeouts: 0,
          messageErrors: 0,
          finalizeAttempts: 0,
          finalizeSuccesses: 0,
          finalizeTimeouts: 0,
          finalizeErrors: 0,
          updatedAt: new Date().toISOString(),
        })),
        record: vi.fn(async (_paths, phase, outcome) => {
          metrics.push({ phase, outcome })
        }),
      },
      conversationLedgerWriter: {
        createThreadOnStartSuccess,
        appendInteractiveMessage,
        clearActiveSession: vi.fn(async () => {}),
      } as never,
      conversationLedgerStore: {
        listOpen: vi.fn(async () => []),
        findWorkspaceByActiveSessionId,
        listArtifacts: vi.fn(async () => []),
        saveArtifacts: vi.fn(async () => {}),
        countTurns: vi.fn(async () => 0),
        updateTitleIfDefault: vi.fn(async () => false),
      } as never,
      ...(emitComposerStream ? { emitComposerStream } : {}),
    })
  }

  it('starts a planning-only session and returns the first turn', async () => {
    const service = createService()
    const turn = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix login',
      workflow: 'default',
    })
    expect(turn.question).toBe('What is the target?')
    expect(turn.sessionId).toMatch(/^composer_/)
    expect(turn.turnIndex).toBe(1)
    expect(persistedSnapshot?.sessionId).toBe(turn.sessionId)
    expect(metrics).toContainEqual({ phase: 'start', outcome: 'success' })
  })

  it('replaces an active session on forceNew start', async () => {
    const service = createService()
    const first = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    const second = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix login',
      forceNew: true,
    })
    expect(second.sessionId).not.toBe(first.sessionId)
    await expect(
      service.message({ sessionId: first.sessionId, message: 'noop' }),
    ).rejects.toBeInstanceOf(ComposerSessionNotFoundError)
  })

  it('resumes a persisted draft when start matches the same seed and workflow', async () => {
    const service = createService()
    const first = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix login',
      workflow: 'default',
      provider: 'mock',
      model: 'mock',
    })
    service.clearAll()

    const resumed = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix login',
      workflow: 'default',
      provider: 'mock',
      model: 'mock',
    })
    expect(resumed.sessionId).toBe(first.sessionId)
    expect(resumed.question).toBe('What is the target?')
  })

  it('discards a persisted draft when start seed or workflow changes', async () => {
    const service = createService()
    const first = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix login',
      workflow: 'default',
    })
    service.clearAll()

    const next = await service.start({
      mode: 'planning-only',
      seedBody: 'Fix auth',
      workflow: 'default',
    })
    expect(next.sessionId).not.toBe(first.sessionId)
  })

  it('discards a persisted draft when model changes for the same provider', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [
        { role: 'assistant', content: 'Hello' },
      ])
      snapshot.provider = input.provider ?? 'copilot'
      snapshot.model = input.model
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Hello' },
        nextSnapshot: snapshot,
      }
    })

    const service = createService()
    const first = await service.start({
      mode: 'interactive-assistant',
      provider: 'copilot',
      model: 'gpt-5.3-codex-high',
    })
    service.clearAll()

    const next = await service.start({
      mode: 'interactive-assistant',
      provider: 'copilot',
      model: 'gpt-5.3-codex',
    })
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(orbitInteractiveStart).toHaveBeenCalledTimes(2)
    expect(orbitInteractiveStart).toHaveBeenLastCalledWith(
      expect.objectContaining({ provider: 'copilot', model: 'gpt-5.3-codex' }),
    )
  })

  it('discards a persisted interactive draft when sourceContext changes', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [], {
        sourceContext: input.sourceContext,
      })
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Scoped?' },
        nextSnapshot: snapshot,
      }
    })

    const service = createService()
    const first = await service.start({
      mode: 'interactive-assistant',
      seedBody: 'Fix login',
      workflow: 'default',
      sourceContext: '## Issue #1',
    })
    service.clearAll()

    const next = await service.start({
      mode: 'interactive-assistant',
      seedBody: 'Fix login',
      workflow: 'default',
      sourceContext: '## Issue #2',
    })
    expect(next.sessionId).not.toBe(first.sessionId)
    expect(orbitInteractiveStart).toHaveBeenCalledTimes(2)
  })

  it('rejects sourceContext when headless interactive is unavailable', async () => {
    const previous = process.env.PLANETZ_INTERACTIVE_ASSIST
    delete process.env.PLANETZ_INTERACTIVE_ASSIST
    try {
      const service = createService()
      await expect(
        service.start({
          mode: 'planning-only',
          seedBody: 'Fix login',
          sourceContext: '## Issue #1',
        }),
      ).rejects.toThrow(COMPOSER_SOURCE_CONTEXT_REQUIRES_INTERACTIVE_SNIPPET)
      expect(orbitInteractiveStart).not.toHaveBeenCalled()
    } finally {
      if (previous === undefined) {
        delete process.env.PLANETZ_INTERACTIVE_ASSIST
      } else {
        process.env.PLANETZ_INTERACTIVE_ASSIST = previous
      }
    }
  })

  it('exposes active session and resumes from persisted snapshot', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    await service.message({ sessionId: turn.sessionId, message: 'Login form only' })
    service.clearAll()

    const active = await service.getActive()
    expect(active?.sessionId).toBe(turn.sessionId)
    expect(active?.seedBody).toBe('Fix login')
    expect(active?.turns).toHaveLength(2)

    const resumed = await service.resume({ sessionId: turn.sessionId })
    expect(resumed.turns[0]?.userReply).toBe('Login form only')
    await expect(
      service.message({ sessionId: turn.sessionId, message: 'No breaking changes' }),
    ).resolves.toMatchObject({ turnIndex: 3 })
  })

  it('hydrates from persisted snapshot on message after in-memory clear', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    service.clearAll()

    await expect(
      service.message({ sessionId: turn.sessionId, message: 'Login form only' }),
    ).resolves.toMatchObject({ turnIndex: 2 })
  })

  it('hydrates from persisted snapshot on finalize after in-memory clear', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    await service.message({ sessionId: turn.sessionId, message: 'Login form only' })
    service.clearAll()

    const finalized = await service.finalize({ sessionId: turn.sessionId })
    expect(finalized.body).toBe('Fix the login form validation.')
    expect(persistedSnapshot).toBeNull()
  })

  it('handles message and finalize within the same session', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    const next = await service.message({ sessionId: turn.sessionId, message: 'Login form only' })
    expect(next.turnIndex).toBe(2)
    const finalized = await service.finalize({ sessionId: turn.sessionId })
    expect(finalized.body).toBe('Fix the login form validation.')
    expect(persistedSnapshot).toBeNull()
    expect(metrics).toContainEqual({ phase: 'finalize', outcome: 'success' })
  })

  it('forces finalize readiness at max turns', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only' })
    let latest = turn
    for (let index = 0; index < COMPOSER_ASSISTANT_MAX_TURNS; index += 1) {
      latest = await service.message({
        sessionId: turn.sessionId,
        message: `answer ${index}`,
      })
    }
    expect(latest.readyToFinalize).toBe(true)
  })

  it('removes session after finalize', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    await service.message({ sessionId: turn.sessionId, message: 'Login form only' })
    await service.finalize({ sessionId: turn.sessionId })
    await expect(service.finalize({ sessionId: turn.sessionId })).rejects.toBeInstanceOf(
      ComposerSessionNotFoundError,
    )
  })

  it('cancels a session and clears persisted draft', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only' })
    await service.cancel({ sessionId: turn.sessionId })
    expect(persistedSnapshot).toBeNull()
    await expect(service.finalize({ sessionId: turn.sessionId })).rejects.toBeInstanceOf(
      ComposerSessionNotFoundError,
    )
  })

  it('starts an interactive-assistant session via headless orbit', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [
        { role: 'assistant', content: 'What is the scope?' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'What is the scope?' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService()
    const turn = await service.start({
      mode: 'interactive-assistant',
      seedBody: 'Fix login',
      workflow: 'default',
    })
    expect(turn.assistantMessage).toBe('What is the scope?')
    expect(persistedSnapshot?.mode).toBe('interactive-assistant')
    expect(persistedSnapshot && 'orbitSnapshot' in persistedSnapshot).toBe(true)
  })

  it('passes emitComposerStream to orbitInteractiveTurn as onStreamLine', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [
        { role: 'assistant', content: 'Hello' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Hello' },
        nextSnapshot: snapshot,
      }
    })
    vi.mocked(orbitInteractiveTurn).mockImplementation(async (current, message, options) => {
      options?.onStreamLine?.({
        v: 1,
        sessionId: current.planetzSessionId,
        seq: 1,
        event: { type: 'text', data: { text: 'live' } },
      })
      const snapshot = buildOrbitSnapshot(current.planetzSessionId, [
        ...current.messages,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Reply' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Reply' },
        nextSnapshot: snapshot,
      }
    })

    const emitComposerStream = vi.fn()
    const service = createService({ emitComposerStream })
    const turn = await service.start({ mode: 'interactive-assistant' })
    emitComposerStream.mockClear()

    await service.message({ sessionId: turn.sessionId, message: 'More' })

    expect(emitComposerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: turn.sessionId,
        event: { type: 'text', data: { text: 'live' } },
      }),
    )
    expect(orbitInteractiveTurn).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ onStreamLine: expect.any(Function) }),
    )
  })

  it('emitComposerStream emits aborted done line on interrupt during message', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [
        { role: 'assistant', content: 'Hello' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Hello' },
        nextSnapshot: snapshot,
      }
    })

    let turnReject: (reason?: unknown) => void = () => {}
    const turnBlocked = new Promise<never>((_, reject) => {
      turnReject = reject
    })
    vi.mocked(orbitInteractiveTurn).mockImplementation(async () => turnBlocked)

    const emitComposerStream = vi.fn()
    const service = createService({ emitComposerStream })
    const turn = await service.start({ mode: 'interactive-assistant' })
    emitComposerStream.mockClear()

    const messagePromise = service.message({ sessionId: turn.sessionId, message: 'Wait' })
    await vi.waitFor(() => {
      expect(orbitInteractiveTurn).toHaveBeenCalled()
    })

    await service.interrupt({ sessionId: turn.sessionId })
    turnReject(new Error('aborted'))

    await expect(messagePromise).rejects.toThrow()

    expect(emitComposerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: turn.sessionId,
        done: true,
        aborted: true,
      }),
    )
  })

  it('appends to conversation ledger after resume when an open thread exists', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [
        { role: 'assistant', content: 'Hello' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Hello' },
        nextSnapshot: snapshot,
      }
    })
    vi.mocked(orbitInteractiveTurn).mockImplementation(async (current, message) => {
      const snapshot = buildOrbitSnapshot(current.planetzSessionId, [
        ...current.messages,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Follow-up reply' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Follow-up reply' },
        nextSnapshot: snapshot,
      }
    })

    const appendInteractiveMessage = vi.fn(async () => {})
    const findWorkspaceByActiveSessionId = vi.fn(async () => '/tmp/chat-workspace')
    const service = createService({ appendInteractiveMessage, findWorkspaceByActiveSessionId })

    const turn = await service.start({
      mode: 'interactive-assistant',
      conversationLedger: { workspacePath: '/tmp/chat-workspace' },
    })
    appendInteractiveMessage.mockClear()

    service.clearAll()
    await service.resume({ sessionId: turn.sessionId })
    await service.message({ sessionId: turn.sessionId, message: 'More detail' })

    expect(findWorkspaceByActiveSessionId).toHaveBeenCalled()
    expect(appendInteractiveMessage).toHaveBeenCalledWith(
      turn.sessionId,
      '/tmp/chat-workspace',
      'More detail',
      'Follow-up reply',
      'mock',
    )
  })

  it('clears the session when conversation ledger thread creation fails', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: snapshot,
      }
    })

    const createThreadOnStartSuccess = vi.fn(async () => {
      throw new Error('ledger insert failed')
    })
    const service = createService({ createThreadOnStartSuccess })

    await expect(
      service.start({
        mode: 'interactive-assistant',
        conversationLedger: { workspacePath: '/tmp/chat-workspace' },
      }),
    ).rejects.toThrow('ledger insert failed')

    expect(persistedSnapshot).toBeNull()
    await expect(service.getActive()).resolves.toBeNull()
  })

  it('persists interactive conversation on message and finalize', async () => {
    let snapshot = buildOrbitSnapshot('composer_pending', [
      { role: 'assistant', content: 'What is the scope?' },
    ])
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: 'What is the scope?' },
      nextSnapshot: snapshot,
    })
    vi.mocked(orbitInteractiveTurn).mockImplementation(async (current, message) => {
      snapshot = buildOrbitSnapshot(current.planetzSessionId, [
        ...current.messages,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Any constraints?' },
      ])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Any constraints?' },
        nextSnapshot: snapshot,
      }
    })
    vi.mocked(orbitInteractiveFinalize).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'summary',
        task: 'Fix login with no breaking changes.',
        allowedActions: ['execute', 'save_task', 'continue'],
      },
      nextSnapshot: snapshot,
    })

    const service = createService()
    const turn = await service.start({
      mode: 'interactive-assistant',
      seedBody: 'Fix login',
    })
    const next = await service.message({
      sessionId: turn.sessionId,
      message: 'No breaking changes',
    })
    expect(next.assistantMessage).toBe('Any constraints?')
    const finalized = await service.finalize({ sessionId: turn.sessionId })
    expect(finalized.body).toBe('Fix login with no breaking changes.')
    expect(finalized.allowedActions).toEqual(['execute', 'save_task', 'continue'])
    expect(persistedSnapshot).toBeNull()
  })

  it('marks interactive sessions ready to finalize at max assistant turns', async () => {
    const assistantMessages = Array.from({ length: COMPOSER_ASSISTANT_MAX_TURNS }, (_, index) => ({
      role: 'assistant' as const,
      content: `Assistant ${index + 1}`,
    }))
    const snapshot = buildOrbitSnapshot('composer_pending', assistantMessages)
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'assistant_message',
        assistantMessage: assistantMessages.at(-1)?.content ?? '',
      },
      nextSnapshot: snapshot,
    })

    const service = createService()
    const turn = await service.start({
      mode: 'interactive-assistant',
      seedBody: 'Fix login',
    })
    const next = await service.message({ sessionId: turn.sessionId, message: 'One more detail' })
    expect(next.readyToFinalize).toBe(true)
    expect(orbitInteractiveTurn).not.toHaveBeenCalled()
  })

  it('passes sessionPolicy and toolsProfile to headless interactive start for chat', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [], {
        sessionPolicy: input.sessionPolicy,
      })
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService()
    await service.start({
      mode: 'interactive-assistant',
      sessionPolicy: 'planetz-chat-investigate',
      workflow: 'chat-investigation',
    })
    expect(orbitInteractiveStart).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionPolicy: 'planetz-chat-investigate',
        toolsProfile: 'planetz-investigate',
      }),
    )
  })

  it('captures chat apply baseRef before headless interactive start', async () => {
    const callOrder: string[] = []
    const captureChatApplyBaseRef = vi.fn(async () => {
      callOrder.push('capture')
      return 'base-ref-captured'
    })
    const registerChatApplySessionMeta = vi.fn()
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      callOrder.push('start')
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [], {
        sessionPolicy: input.sessionPolicy,
      })
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService({
      captureChatApplyBaseRef,
      registerChatApplySessionMeta,
    })
    await service.start({
      mode: 'interactive-assistant',
      sessionPolicy: 'planetz-chat-agent',
      workflow: 'chat-investigation',
      conversationLedger: { workspacePath: '/tmp/chat-workspace' },
    })
    expect(callOrder).toEqual(['capture', 'start'])
    expect(captureChatApplyBaseRef).toHaveBeenCalledOnce()
    expect(registerChatApplySessionMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRef: 'base-ref-captured',
        workspacePath: '/tmp/chat-workspace',
        isolatedRepoPath: '/tmp/isolated',
      }),
    )
  })

  it('does not persist mcpServers on agent interactive sessions', async () => {
    const resolveMcpServersForAgent = vi.fn(async () => ({
      legacy_leak: { command: 'echo', args: ['secret'] },
    }))
    const resolveMcpAllowedToolsForAgent = vi.fn(async () => ['search_issues'])
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(
        input.planetzSessionId,
        [{ role: 'assistant', content: 'ok' }],
        { sessionPolicy: 'planetz-chat-agent' },
      )
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'ok' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService({ resolveMcpServersForAgent, resolveMcpAllowedToolsForAgent })
    await service.start({
      mode: 'interactive-assistant',
      sessionPolicy: 'planetz-chat-agent',
      workflow: 'chat-investigation',
    })
    expect(resolveMcpServersForAgent).toHaveBeenCalled()
    expect(resolveMcpAllowedToolsForAgent).toHaveBeenCalled()
    expect(persistedSnapshot?.mode).toBe('interactive-assistant')
    if (persistedSnapshot?.mode === 'interactive-assistant') {
      expect(persistedSnapshot.orbitSnapshot).not.toHaveProperty('mcpServers')
    }
  })

  it('strips legacy mcpServers from persisted snapshot on resume and re-resolves MCP', async () => {
    const legacyMcp = {
      legacy_leak: { command: 'echo', args: ['from-sidecar'] },
    }
    const freshMcp = {
      fresh: { command: 'true', args: [] as string[] },
    }
    const resolveMcpServersForAgent = vi.fn(async () => freshMcp)
    const resolveMcpAllowedToolsForAgent = vi.fn(async () => ['search_issues'])
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(
        input.planetzSessionId,
        [{ role: 'assistant', content: 'ok' }],
        { sessionPolicy: 'planetz-chat-agent' },
      )
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'ok' },
        nextSnapshot: snapshot,
      }
    })
    vi.mocked(orbitInteractiveTurn).mockImplementation(async (current, message) => {
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: `reply:${message}` },
        nextSnapshot: current,
      }
    })
    const service = createService({
      resolveMcpServersForAgent,
      resolveMcpAllowedToolsForAgent,
    })
    const turn = await service.start({
      mode: 'interactive-assistant',
      sessionPolicy: 'planetz-chat-agent',
      workflow: 'chat-investigation',
    })
    if (persistedSnapshot?.mode !== 'interactive-assistant') {
      throw new Error('expected interactive-assistant persisted snapshot')
    }
    persistedSnapshot = {
      ...persistedSnapshot,
      orbitSnapshot: {
        ...persistedSnapshot.orbitSnapshot,
        mcpServers: legacyMcp,
      } as OrbitInteractiveSnapshot,
    }
    resolveMcpServersForAgent.mockClear()
    service.clearAll()

    await service.resume({ sessionId: turn.sessionId })
    expect(resolveMcpServersForAgent).toHaveBeenCalled()
    expect(resolveMcpAllowedToolsForAgent).toHaveBeenCalled()
    await service.message({ sessionId: turn.sessionId, message: 'next' })
    expect(orbitInteractiveTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: freshMcp,
        allowedTools: expect.arrayContaining(['search_issues']),
      }),
      'next',
      expect.any(Object),
    )
  })

  it('passes agent sessionPolicy and planetz-agent-edit toolsProfile for chat agent', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [], {
        sessionPolicy: input.sessionPolicy,
      })
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService()
    await service.start({
      mode: 'interactive-assistant',
      sessionPolicy: 'planetz-chat-agent',
      workflow: 'chat-investigation',
    })
    expect(orbitInteractiveStart).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionPolicy: 'planetz-chat-agent',
        toolsProfile: 'planetz-agent-edit',
      }),
    )
  })

  it('passes sourceContext to headless interactive start', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [], {
        sourceContext: input.sourceContext,
      })
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: '' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService()
    await service.start({
      mode: 'interactive-assistant',
      sourceContext: '## Issue #42: Login bug',
      workflow: 'default',
    })
    expect(orbitInteractiveStart).toHaveBeenCalledWith(
      expect.objectContaining({ sourceContext: '## Issue #42: Login bug' }),
    )
    expect(
      persistedSnapshot?.mode === 'interactive-assistant' &&
        persistedSnapshot.orbitSnapshot.sourceContext === '## Issue #42: Login bug',
    ).toBe(true)
  })

  it('rejects accept on planning-only sessions', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    await expect(service.accept({ sessionId: turn.sessionId })).rejects.toThrow(
      'Accept is only available for interactive-assistant sessions',
    )
  })

  it('propagates headless accept errors', async () => {
    const snapshot = buildOrbitSnapshot('composer_accept_err', [
      { role: 'assistant', content: 'Draft' },
    ])
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: 'Draft' },
      nextSnapshot: snapshot,
    })
    vi.mocked(orbitInteractiveAccept).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: false,
      result: { kind: 'error', error: 'No assistant message to accept' },
      nextSnapshot: snapshot,
    })
    const service = createService()
    const turn = await service.start({ mode: 'interactive-assistant' })
    await expect(service.accept({ sessionId: turn.sessionId })).rejects.toThrow(
      'No assistant message to accept',
    )
    expect(persistedSnapshot?.sessionId).toBe(turn.sessionId)
  })

  it('accept returns latest assistant task for summary actions', async () => {
    const snapshot = buildOrbitSnapshot('composer_accept', [
      { role: 'assistant', content: 'Use JWT for auth' },
    ])
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: 'Use JWT for auth' },
      nextSnapshot: snapshot,
    })
    vi.mocked(orbitInteractiveAccept).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'accept',
        task: 'Use JWT for auth',
        allowedActions: ['execute', 'save_task'],
      },
      nextSnapshot: snapshot,
    })
    const service = createService()
    const turn = await service.start({ mode: 'interactive-assistant' })
    const accepted = await service.accept({ sessionId: turn.sessionId })
    expect(accepted.body).toBe('Use JWT for auth')
    expect(accepted.allowedActions).toEqual(['execute', 'save_task'])
    expect(persistedSnapshot).toBeNull()
  })

  it('rejects play on planning-only sessions', async () => {
    const service = createService()
    const turn = await service.start({ mode: 'planning-only', seedBody: 'Fix login' })
    await expect(service.play({ sessionId: turn.sessionId, task: 'Run tests' })).rejects.toThrow(
      'Play is only available for interactive-assistant sessions',
    )
  })

  it('propagates headless play errors', async () => {
    const snapshot = buildOrbitSnapshot('composer_play_err', [])
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: '' },
      nextSnapshot: snapshot,
    })
    vi.mocked(orbitInteractivePlay).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: false,
      result: { kind: 'error', error: 'Task must not be empty' },
      nextSnapshot: snapshot,
    })
    const service = createService()
    const turn = await service.start({ mode: 'interactive-assistant' })
    await expect(service.play({ sessionId: turn.sessionId, task: 'Run tests' })).rejects.toThrow(
      'Task must not be empty',
    )
    expect(persistedSnapshot?.sessionId).toBe(turn.sessionId)
  })

  it('play returns explicit task for summary actions', async () => {
    const snapshot = buildOrbitSnapshot('composer_play', [])
    vi.mocked(orbitInteractiveStart).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: '' },
      nextSnapshot: snapshot,
    })
    vi.mocked(orbitInteractivePlay).mockResolvedValue({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'play',
        task: 'Run integration tests for login',
        allowedActions: ['execute', 'save_task'],
      },
      nextSnapshot: snapshot,
    })
    const service = createService()
    const turn = await service.start({ mode: 'interactive-assistant' })
    const played = await service.play({
      sessionId: turn.sessionId,
      task: 'Run integration tests for login',
    })
    expect(played.body).toBe('Run integration tests for login')
    expect(persistedSnapshot).toBeNull()
  })

  it('does not call orbitInteractiveTurn when context exceeds hard limit after compaction', async () => {
    vi.mocked(orbitInteractiveStart).mockImplementation(async (input) => {
      const snapshot = buildOrbitSnapshot(input.planetzSessionId, [])
      return {
        contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
        ok: true,
        result: { kind: 'assistant_message', assistantMessage: 'Hello' },
        nextSnapshot: snapshot,
      }
    })
    const service = createService()
    const turn = await service.start({ mode: 'interactive-assistant' })
    vi.mocked(orbitInteractiveTurn).mockClear()
    const huge = 'token '.repeat(80_000)
    await expect(service.message({ sessionId: turn.sessionId, message: huge })).rejects.toThrow(
      COMPOSER_CONTEXT_TOO_LARGE_SNIPPET,
    )
    expect(orbitInteractiveTurn).not.toHaveBeenCalled()
  })
})
