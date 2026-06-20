import {
  type ComposerAssistantTurn,
  composerSessionNotFoundMessage,
  headlessInteractiveUnavailableMessage,
} from '@planetz/shared'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { ComposerAssistPanel } from '../composer-assist-panel.js'

function renderPanel(
  overrides: Parameters<typeof installOrbitMock>[0] = {},
  props: Partial<ComponentProps<typeof ComposerAssistPanel>> = {},
) {
  const onFinalize = props.onFinalize ?? vi.fn(async () => {})
  const onBackToDirect = props.onBackToDirect ?? vi.fn()
  installOrbitMock(overrides)
  return render(
    <I18nProvider>
      <ComposerAssistPanel
        seedBody="Fix login"
        workflow="default"
        onFinalize={onFinalize}
        onBackToDirect={onBackToDirect}
        {...props}
      />
    </I18nProvider>,
  )
}

describe('ComposerAssistPanel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useAppStore.getState().setUiPreferences({
      themeId: useAppStore.getState().themeId,
      counterPackEnabled: useAppStore.getState().counterPackEnabled,
      uiLanguage: 'en',
    })
  })

  it('shows a busy placeholder while the first session is starting', async () => {
    let resolveStart: ((value: ComposerAssistantTurn) => void) | undefined
    const startComposerSession = vi.fn(
      (): Promise<ComposerAssistantTurn> =>
        new Promise((resolve) => {
          resolveStart = resolve
        }),
    )
    renderPanel({ getActiveComposerSession: vi.fn(async () => null), startComposerSession })

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalled()
      expect(resolveStart).toBeDefined()
    })

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/Starting assistant/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Finalize' })).toBeNull()

    resolveStart?.({
      sessionId: 'composer_test',
      question: 'What is the scope?',
      recommendedAnswer: 'Fix login bug',
      turnIndex: 1,
      readyToFinalize: false,
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back to direct input' })).toBeTruthy()
  })

  it('starts a session on mount and shows the first question', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_test',
      question: 'What is the scope?',
      recommendedAnswer: 'Fix login bug',
      turnIndex: 1,
      readyToFinalize: false,
    }))
    renderPanel({ getActiveComposerSession: vi.fn(async () => null), startComposerSession })

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'interactive-assistant',
          seedBody: 'Fix login',
          workflow: 'default',
        }),
      )
    })
    expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
  })

  it('restores a persisted draft on mount', async () => {
    const resumeComposerSession = vi.fn(async () => ({
      sessionId: 'composer_saved',
      workflow: 'default',
      seedBody: 'Fix login',
      turns: [
        {
          question: 'What is broken?',
          recommendedAnswer: 'Login form',
          userReply: 'Submit button',
        },
        {
          question: 'Any constraints?',
          recommendedAnswer: 'No breaking changes',
        },
      ],
      readyToFinalize: false,
      turnIndex: 2,
    }))
    const startComposerSession = vi.fn()
    renderPanel({
      getActiveComposerSession: vi.fn(async () => ({
        sessionId: 'composer_saved',
        workflow: 'default',
        seedBody: 'Fix login',
        turns: [
          {
            question: 'What is broken?',
            recommendedAnswer: 'Login form',
            userReply: 'Submit button',
          },
          {
            question: 'Any constraints?',
            recommendedAnswer: 'No breaking changes',
          },
        ],
        readyToFinalize: false,
        turnIndex: 2,
      })),
      resumeComposerSession,
      startComposerSession,
    })

    await waitFor(() => {
      expect(resumeComposerSession).toHaveBeenCalledWith({ sessionId: 'composer_saved' })
    })
    expect(startComposerSession).not.toHaveBeenCalled()
    expect(screen.getByText(/What is broken\?/)).toBeTruthy()
    expect(screen.getByText(/Resuming your saved draft\./)).toBeTruthy()
  })

  it('starts fresh when persisted draft workflow does not match', async () => {
    const startComposerSession = vi.fn(async () => ({
      sessionId: 'composer_new',
      question: 'What is the scope?',
      recommendedAnswer: 'Fix login bug',
      turnIndex: 1,
      readyToFinalize: false,
    }))
    const resumeComposerSession = vi.fn()
    renderPanel({
      getActiveComposerSession: vi.fn(async () => ({
        sessionId: 'composer_saved',
        workflow: 'other-workflow',
        seedBody: 'Fix login',
        turns: [
          {
            question: 'What is broken?',
            recommendedAnswer: 'Login form',
          },
        ],
        readyToFinalize: false,
        turnIndex: 1,
      })),
      resumeComposerSession,
      startComposerSession,
    })

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalled()
    })
    expect(resumeComposerSession).not.toHaveBeenCalled()
  })

  it('resumes session when send fails with composer session not found', async () => {
    const ipcWrappedNotFound = new Error(
      `Error invoking remote method 'composerSession:message': ComposerSessionNotFoundError: ${composerSessionNotFoundMessage('composer_test')}`,
    )
    const resumeComposerSession = vi.fn(async () => ({
      sessionId: 'composer_test',
      workflow: 'default',
      seedBody: 'Fix login',
      turns: [
        {
          question: 'What is the scope?',
          recommendedAnswer: 'Fix login bug',
        },
      ],
      readyToFinalize: false,
      turnIndex: 1,
    }))
    const messageComposerSession = vi
      .fn()
      .mockRejectedValueOnce(ipcWrappedNotFound)
      .mockResolvedValueOnce({
        sessionId: 'composer_test',
        question: 'Any constraints?',
        recommendedAnswer: 'No breaking changes',
        turnIndex: 2,
        readyToFinalize: true,
      })
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      resumeComposerSession,
      messageComposerSession,
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    const textarea = screen.getByPlaceholderText('Your answer…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(resumeComposerSession).toHaveBeenCalledWith({ sessionId: 'composer_test' })
    })
    await waitFor(() => {
      expect(screen.getByText(/Any constraints\?/)).toBeTruthy()
    })
    expect(messageComposerSession).toHaveBeenCalledTimes(2)
  })

  it('retries send with a new session id after recovery via beginSession', async () => {
    const ipcWrappedNotFound = new Error(
      `Error invoking remote method 'composerSession:message': ComposerSessionNotFoundError: ${composerSessionNotFoundMessage('composer_old')}`,
    )
    const startComposerSession = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: 'composer_old',
        question: 'What is the scope?',
        recommendedAnswer: 'Fix login bug',
        turnIndex: 1,
        readyToFinalize: false,
      })
      .mockResolvedValueOnce({
        sessionId: 'composer_new',
        question: 'What is the scope?',
        recommendedAnswer: 'Fix login bug',
        turnIndex: 1,
        readyToFinalize: false,
      })
    const messageComposerSession = vi
      .fn()
      .mockRejectedValueOnce(ipcWrappedNotFound)
      .mockResolvedValueOnce({
        sessionId: 'composer_new',
        question: 'Any constraints?',
        recommendedAnswer: 'No breaking changes',
        turnIndex: 2,
        readyToFinalize: true,
      })
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      resumeComposerSession: vi.fn(async () => {
        throw new Error('no snapshot')
      }),
      startComposerSession,
      messageComposerSession,
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    const textarea = screen.getByPlaceholderText('Your answer…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(messageComposerSession).toHaveBeenLastCalledWith({
        sessionId: 'composer_new',
        message: 'my answer',
      })
    })
  })

  it('shows session expired message when not found recovery fails', async () => {
    const ipcWrappedNotFound = new Error(
      `Error invoking remote method 'composerSession:message': ComposerSessionNotFoundError: ${composerSessionNotFoundMessage('composer_test')}`,
    )
    const startComposerSession = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: 'composer_test',
        question: 'What is the scope?',
        recommendedAnswer: 'Fix login bug',
        turnIndex: 1,
        readyToFinalize: false,
      })
      .mockRejectedValueOnce(new Error('cannot start'))
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      resumeComposerSession: vi.fn(async () => {
        throw new Error('no snapshot')
      }),
      startComposerSession,
      messageComposerSession: vi.fn().mockRejectedValueOnce(ipcWrappedNotFound),
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    const textarea = screen.getByPlaceholderText('Your answer…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getByText(/This assist session is no longer available/i)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('restores reply text and offers retry when send fails', async () => {
    const messageComposerSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        sessionId: 'composer_test',
        question: 'Any constraints?',
        recommendedAnswer: 'No breaking changes',
        assistantMessage: 'Any constraints?',
        turnIndex: 2,
        readyToFinalize: true,
      })
    renderPanel({ getActiveComposerSession: vi.fn(async () => null), messageComposerSession })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getByText('network error')).toBeTruthy()
    })
    expect(textarea.value).toBe('my answer')
    expect(screen.queryByText('my answer', { selector: 'p' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('my answer')).toBeTruthy()
      expect(screen.getByText(/Any constraints\?/)).toBeTruthy()
    })
    expect(messageComposerSession).toHaveBeenCalledTimes(2)
  })

  it('keeps the assist session after locale changes', async () => {
    const cancelComposerSession = vi.fn(async () => {})
    const messageComposerSession = vi.fn(async () => ({
      sessionId: 'composer_test',
      question: 'Any constraints?',
      recommendedAnswer: 'No breaking changes',
      turnIndex: 2,
      readyToFinalize: true,
    }))
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      cancelComposerSession,
      messageComposerSession,
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    useAppStore.getState().setUiPreferences({
      themeId: useAppStore.getState().themeId,
      counterPackEnabled: useAppStore.getState().counterPackEnabled,
      uiLanguage: 'ja',
    })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('回答を入力…')).toBeTruthy()
    })
    expect(cancelComposerSession).not.toHaveBeenCalled()

    const textarea = screen.getByPlaceholderText('回答を入力…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my answer' } })
    fireEvent.click(screen.getByRole('button', { name: '送信' }))

    await waitFor(() => {
      expect(messageComposerSession).toHaveBeenCalledWith({
        sessionId: 'composer_test',
        message: 'my answer',
      })
    })
  })

  it('falls back to planning-only when headless start is unavailable', async () => {
    const startComposerSession = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          `Error invoking remote method 'composerSession:start': ${headlessInteractiveUnavailableMessage('runner missing')}`,
        ),
      )
      .mockResolvedValueOnce({
        sessionId: 'composer_planning',
        question: 'What is the scope?',
        recommendedAnswer: 'Fix login bug',
        turnIndex: 1,
        readyToFinalize: false,
      })
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      getComposerAssistCapabilities: vi.fn<OrbitBridge['getComposerAssistCapabilities']>(
        async () => ({
          startMode: 'interactive-assistant',
          headlessRunnerReady: true,
        }),
      ),
      startComposerSession,
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })
    expect(startComposerSession).toHaveBeenCalledTimes(2)
    expect(startComposerSession.mock.calls[0]?.[0]).toMatchObject({
      mode: 'interactive-assistant',
    })
    expect(startComposerSession.mock.calls[1]?.[0]).toMatchObject({
      mode: 'planning-only',
    })
  })

  it('returns to direct input when the close control is clicked', async () => {
    const onBackToDirect = vi.fn()
    const cancelComposerSession = vi.fn(async () => {})
    renderPanel(
      { getActiveComposerSession: vi.fn(async () => null), cancelComposerSession },
      { onBackToDirect },
    )

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Back to direct input' }))

    await waitFor(() => {
      expect(cancelComposerSession).toHaveBeenCalled()
      expect(onBackToDirect).toHaveBeenCalled()
    })
    expect(screen.getAllByRole('button', { name: 'Back to direct input' })).toHaveLength(1)
  })

  it('offers retry when finalize fails', async () => {
    const onFinalize = vi.fn(async () => {})
    const finalizeComposerSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('finalize failed'))
      .mockResolvedValueOnce({
        sessionId: 'composer_test',
        body: 'Fix the login bug without breaking changes.',
      })
    renderPanel(
      {
        getActiveComposerSession: vi.fn(async () => null),
        startComposerSession: vi.fn(async () => ({
          sessionId: 'composer_test',
          question: 'What is the scope?',
          recommendedAnswer: 'Fix login bug',
          turnIndex: 1,
          readyToFinalize: true,
        })),
        finalizeComposerSession,
      },
      { onFinalize },
    )

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Finalize' }))

    await waitFor(() => {
      expect(screen.getByText('finalize failed')).toBeTruthy()
    })
    expect(onFinalize).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(onFinalize).toHaveBeenCalledWith('Fix the login bug without breaking changes.')
    })
    expect(finalizeComposerSession).toHaveBeenCalledTimes(2)
  })

  // --- Phase 2: source context handoff + accept / play ---

  /** Start config that lands the panel in headless interactive conversation mode. */
  const interactiveStart = (assistantMessage = 'Here is a refined plan.') =>
    vi.fn(async () => ({
      sessionId: 'composer_test',
      question: '',
      recommendedAnswer: '',
      assistantMessage,
      turnIndex: 1,
      readyToFinalize: true,
    }))

  it('passes sourceContext and forces a new session on handoff', async () => {
    const startComposerSession = interactiveStart()
    const getActiveComposerSession = vi.fn(async () => null)
    renderPanel(
      { getActiveComposerSession, startComposerSession },
      {
        sourceContext: '## Issue guilz-dev/planetz#123\nFix the login bug',
        sourceContextRef: 'guilz-dev/planetz#123',
      },
    )

    await waitFor(() => {
      expect(startComposerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'interactive-assistant',
          sourceContext: '## Issue guilz-dev/planetz#123\nFix the login bug',
          forceNew: true,
        }),
      )
    })
    // Handoff bypasses the resume-match lookup entirely.
    expect(getActiveComposerSession).not.toHaveBeenCalled()
    expect(screen.getByText(/Referencing guilz-dev\/planetz#123/)).toBeTruthy()
  })

  it('accepts the latest reply and previews run/queue without continue', async () => {
    const acceptComposerSession = vi.fn(async () => ({
      sessionId: 'composer_test',
      body: 'Accepted assistant draft',
      allowedActions: ['execute', 'save_task'] as Array<'execute' | 'save_task' | 'continue'>,
    }))
    const onRunNow = vi.fn(async () => {})
    renderPanel(
      {
        getActiveComposerSession: vi.fn(async () => null),
        startComposerSession: interactiveStart(),
        acceptComposerSession,
      },
      { onRunNow },
    )

    await waitFor(() => {
      expect(screen.getByText(/Here is a refined plan\./)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Use latest reply' }))

    await waitFor(() => {
      expect(acceptComposerSession).toHaveBeenCalledWith({ sessionId: 'composer_test' })
      expect(screen.getByText('Accepted assistant draft')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Run now' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add to queue' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continue conversation' })).toBeNull()
  })

  it('runs the typed instruction via play with the reply as the task', async () => {
    const playComposerSession = vi.fn(async () => ({
      sessionId: 'composer_test',
      body: 'Play task draft',
      allowedActions: ['execute', 'save_task'] as Array<'execute' | 'save_task' | 'continue'>,
    }))
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      startComposerSession: interactiveStart(),
      playComposerSession,
    })

    await waitFor(() => {
      expect(screen.getByText(/Here is a refined plan\./)).toBeTruthy()
    })

    // Empty reply keeps Run instruction disabled (no empty task can be submitted).
    const runInstruction = screen.getByRole('button', {
      name: 'Run instruction',
    }) as HTMLButtonElement
    expect(runInstruction.disabled).toBe(true)

    const textarea = screen.getByPlaceholderText('Message the assistant…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Focus on the submit handler' } })

    expect(
      (screen.getByRole('button', { name: 'Run instruction' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Run instruction' }))

    await waitFor(() => {
      expect(playComposerSession).toHaveBeenCalledWith({
        sessionId: 'composer_test',
        task: 'Focus on the submit handler',
      })
      expect(screen.getByText('Play task draft')).toBeTruthy()
    })
  })

  it('hides accept / play outside headless interactive mode', async () => {
    renderPanel({
      getActiveComposerSession: vi.fn(async () => null),
      startComposerSession: vi.fn(async () => ({
        sessionId: 'composer_test',
        question: 'What is the scope?',
        recommendedAnswer: 'Fix login bug',
        turnIndex: 1,
        readyToFinalize: false,
      })),
    })

    await waitFor(() => {
      expect(screen.getByText(/What is the scope\?/)).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: 'Use latest reply' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run instruction' })).toBeNull()
  })
})
