import { CHAT_INVESTIGATION_WORKFLOW_NAME, COMPOSER_DEFAULT_WORKFLOW_NAME } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultOrbitBridge,
  desktopCapabilities,
  installOrbitMock,
} from '../../__tests__/orbit-mock'
import { createOrbitChatGateway } from '../orbit-chat-gateway'

describe('createOrbitChatGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists and maps conversation history threads', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getDesktopCapabilities: vi.fn(async () =>
          desktopCapabilities({ conversationModeEnabled: true }),
        ),
        listConversationHistory: vi.fn(async () => ({
          threads: [
            {
              threadId: 'thr_1',
              title: 'First',
              workspacePath: '/repo/main',
              workspaceLabel: 'main',
              updatedAt: '2026-06-01T00:00:00.000Z',
              hasActiveSession: true,
              activeSessionId: 'composer_1',
            },
          ],
        })),
      }),
    )

    const gateway = createOrbitChatGateway()
    const threads = await gateway.listThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0]?.id).toBe('thr_1')
    expect(threads[0]?.hasActiveSession).toBe(true)
  })

  it('resumes active session when loading a thread', async () => {
    const resumeComposerSession = vi.fn(async () => ({
      sessionId: 'composer_1',
      turns: [],
      readyToFinalize: false,
      turnIndex: 0,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory: vi.fn(async () => ({
          found: true as const,
          thread: {
            threadId: 'thr_1',
            title: 'Live',
            workspacePath: '/repo/main',
            workspaceLabel: 'main',
            updatedAt: '2026-06-01T00:00:00.000Z',
            hasActiveSession: true,
            activeSessionId: 'composer_1',
          },
          turns: [
            {
              turnId: 'turn_1',
              role: 'user' as const,
              content: 'Hi',
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        })),
        resumeComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    const loaded = await gateway.getThread('thr_1')
    expect(resumeComposerSession).toHaveBeenCalledWith({ sessionId: 'composer_1' })
    expect(loaded.turns[0]?.content).toBe('Hi')
  })

  it('falls back to active composer sessionPolicy when ledger row has none', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory: vi.fn(async () => ({
          found: true as const,
          thread: {
            threadId: 'thr_legacy',
            title: 'Legacy',
            workspacePath: '/repo/main',
            workspaceLabel: 'main',
            updatedAt: '2026-06-01T00:00:00.000Z',
            hasActiveSession: true,
            activeSessionId: 'composer_legacy',
          },
          turns: [],
        })),
        getActiveComposerSession: vi.fn(async () => ({
          sessionId: 'composer_legacy',
          sessionPolicy: 'planetz-chat-spec' as const,
          turns: [],
          readyToFinalize: false,
          turnIndex: 0,
        })),
        resumeComposerSession: vi.fn(async () => ({
          sessionId: 'composer_legacy',
          turns: [],
          readyToFinalize: false,
          turnIndex: 0,
        })),
      }),
    )

    const gateway = createOrbitChatGateway()
    const loaded = await gateway.getThread('thr_legacy')
    expect(loaded.sessionPolicy).toBe('planetz-chat-spec')
  })

  it('starts interactive session with conversation ledger metadata', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_new',
      question: '',
      recommendedAnswer: '',
      turnIndex: 0,
      readyToFinalize: false,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        startComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    const started = await gateway.startThread({
      workspacePath: '/repo/main',
      branch: 'develop',
      model: 'sonnet',
      effort: 'high',
      mode: 'interactive',
    })
    expect(started.threadId).toBe('composer_new')
    expect(startComposerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'interactive-assistant',
        workflow: CHAT_INVESTIGATION_WORKFLOW_NAME,
        forceNew: true,
        sessionPolicy: 'planetz-chat-investigate',
        conversationLedger: { workspacePath: '/repo/main', branch: 'develop' },
        model: 'sonnet',
        effort: 'high',
      }),
    )
  })

  it('uses minimal workflow for spec mode start', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_spec',
      question: '',
      recommendedAnswer: '',
      turnIndex: 0,
      readyToFinalize: false,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        startComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    await gateway.startThread({
      workspacePath: '/repo/main',
      mode: 'spec',
    })

    expect(startComposerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: COMPOSER_DEFAULT_WORKFLOW_NAME,
        sessionPolicy: 'planetz-chat-spec',
      }),
    )
  })

  it('uses investigation workflow and agent session policy for agent mode start', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_agent',
      question: '',
      recommendedAnswer: '',
      turnIndex: 0,
      readyToFinalize: false,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        startComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    await gateway.startThread({
      workspacePath: '/repo/main',
      mode: 'agent',
    })

    expect(startComposerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: CHAT_INVESTIGATION_WORKFLOW_NAME,
        sessionPolicy: 'planetz-chat-agent',
      }),
    )
  })

  it('getActiveComposerSessionId returns ledger activeSessionId', async () => {
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory: vi.fn(async () => ({
          found: true as const,
          thread: {
            threadId: 'thr_1',
            title: 'Live',
            workspacePath: '/repo/main',
            workspaceLabel: 'main',
            updatedAt: '2026-06-01T00:00:00.000Z',
            hasActiveSession: true,
            activeSessionId: 'composer_1',
          },
          turns: [],
        })),
      }),
    )

    const gateway = createOrbitChatGateway()
    await expect(gateway.getActiveComposerSessionId('thr_1')).resolves.toBe('composer_1')
  })

  it('sendMessage uses activeSessionId from history', async () => {
    const getConversationHistory = vi.fn(async () => ({
      found: true as const,
      thread: {
        threadId: 'thr_1',
        title: 'Live',
        workspacePath: '/repo/main',
        workspaceLabel: 'main',
        updatedAt: '2026-06-01T00:00:00.000Z',
        hasActiveSession: true,
        activeSessionId: 'composer_1',
      },
      turns: [],
    }))
    const messageComposerSession = vi.fn(async () => ({
      sessionId: 'composer_1',
      question: '',
      recommendedAnswer: '',
      assistantMessage: 'Reply',
      turnIndex: 1,
      readyToFinalize: true,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory,
        messageComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    await gateway.sendMessage({ threadId: 'thr_1', message: 'More' })
    expect(messageComposerSession).toHaveBeenCalledWith({
      sessionId: 'composer_1',
      message: 'More',
    })
    expect(getConversationHistory).toHaveBeenCalledTimes(1)
  })

  it('sendMessage uses composerSessionId without refetching history', async () => {
    const getConversationHistory = vi.fn(async () => ({
      found: true as const,
      thread: {
        threadId: 'thr_1',
        title: 'Live',
        workspacePath: '/repo/main',
        workspaceLabel: 'main',
        updatedAt: '2026-06-01T00:00:00.000Z',
        hasActiveSession: true,
        activeSessionId: 'composer_1',
      },
      turns: [],
    }))
    const messageComposerSession = vi.fn(async () => ({
      sessionId: 'composer_1',
      question: '',
      recommendedAnswer: '',
      assistantMessage: 'Reply',
      turnIndex: 1,
      readyToFinalize: true,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory,
        messageComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    await gateway.sendMessage({
      threadId: 'thr_1',
      message: 'More',
      composerSessionId: 'composer_1',
    })
    expect(getConversationHistory).not.toHaveBeenCalled()
    expect(messageComposerSession).toHaveBeenCalledWith({
      sessionId: 'composer_1',
      message: 'More',
    })
  })

  it('finalizeThread calls finalizeComposerSession', async () => {
    const finalizeComposerSession = vi.fn(async () => ({
      sessionId: 'composer_1',
      body: 'Task body',
      allowedActions: ['save_task', 'continue'] as Array<'save_task' | 'continue'>,
    }))
    installOrbitMock(
      createDefaultOrbitBridge({
        getConversationHistory: vi.fn(async () => ({
          found: true as const,
          thread: {
            threadId: 'thr_1',
            title: 'Live',
            workspacePath: '/repo/main',
            workspaceLabel: 'main',
            updatedAt: '2026-06-01T00:00:00.000Z',
            hasActiveSession: true,
            activeSessionId: 'composer_1',
          },
          turns: [],
        })),
        finalizeComposerSession,
      }),
    )

    const gateway = createOrbitChatGateway()
    const result = await gateway.finalizeThread({ threadId: 'thr_1' })
    expect(finalizeComposerSession).toHaveBeenCalledWith({ sessionId: 'composer_1' })
    expect(result.body).toBe('Task body')
    expect(result.allowedActions).toEqual(['save_task', 'continue'])
  })
})
