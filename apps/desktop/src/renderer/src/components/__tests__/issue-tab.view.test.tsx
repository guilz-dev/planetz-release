import type { GitHubIssueView, TaskViewModel, WorkflowSummary } from '@planetz/shared'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock, minimalAppState } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { IssueTab } from '../issue-tab.js'

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createListItem(number: number, title: string) {
  return {
    repository: { owner: 'guilz-dev', name: 'planetz' },
    number,
    title,
    url: `https://github.com/guilz-dev/planetz/issues/${number}`,
    createdAt: '2026-05-31T00:00:00Z',
    state: 'open' as const,
    labels: ['enhancement'],
    author: 'kaz',
  }
}

const DEFAULT_WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'project',
  stepNames: [],
  agentRoles: [],
  steps: [],
  isOverridden: false,
  diagnostics: [],
}

function createRunningTaskForIssue(number: number, title: string): TaskViewModel {
  const now = '2026-05-31T00:00:00Z'
  return {
    id: `run-${number}`,
    title,
    issueRef: `guilz-dev/planetz#${number}`,
    issueNumber: number,
    priority: 'normal',
    status: 'running',
    source: 'takt',
    createdAt: now,
    updatedAt: now,
  }
}

function createPendingTaskForIssue(number: number, title: string): TaskViewModel {
  const now = '2026-05-31T00:00:00Z'
  return {
    id: `pending-${number}`,
    title,
    issueRef: `guilz-dev/planetz#${number}`,
    issueNumber: number,
    priority: 'normal',
    status: 'pending',
    source: 'takt',
    createdAt: now,
    updatedAt: now,
  }
}

function createCompletedTaskForIssue(number: number, title: string): TaskViewModel {
  const now = '2026-05-31T00:00:00Z'
  return {
    id: `done-${number}`,
    title,
    issueRef: `guilz-dev/planetz#${number}`,
    issueNumber: number,
    priority: 'normal',
    status: 'completed',
    source: 'takt',
    createdAt: now,
    updatedAt: now,
  }
}

function renderIssueTab(
  overrides: Partial<OrbitBridge> = {},
  pendingCount = 0,
  workspacePath = '/tmp/workspace-a',
  tasks: TaskViewModel[] = [],
) {
  const listOpenGitHubIssues =
    overrides.listOpenGitHubIssues ??
    vi.fn<OrbitBridge['listOpenGitHubIssues']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [createListItem(368, 'List issue 368')],
      pageInfo: { endCursor: null, hasNextPage: false },
    }))
  const fetchGitHubIssue =
    overrides.fetchGitHubIssue ??
    vi.fn<OrbitBridge['fetchGitHubIssue']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Detail issue 368',
      body: 'Issue body',
      url: 'https://github.com/guilz-dev/planetz/issues/368',
      state: 'open',
      labels: ['enhancement'],
      author: 'kaz',
    }))
  const enqueueTask =
    overrides.enqueueTask ??
    vi.fn<OrbitBridge['enqueueTask']>(async () => ({ taskId: 'task-from-issue' }))
  const runPendingTask =
    overrides.runPendingTask ?? vi.fn<OrbitBridge['runPendingTask']>(async () => {})

  installOrbitMock({
    listOpenGitHubIssues,
    fetchGitHubIssue,
    enqueueTask,
    runPendingTask,
    ...(overrides.buildComposerSourceContext
      ? { buildComposerSourceContext: overrides.buildComposerSourceContext }
      : {}),
  })
  useAppStore.setState({
    uiLanguage: 'en',
    selectedWorkflow: 'default',
    workflowMode: 'manual',
    state: minimalAppState({ tasks }),
  })

  const view = render(
    <I18nProvider>
      <IssueTab
        workspacePath={workspacePath}
        workflows={[DEFAULT_WORKFLOW]}
        recentWorkflowNames={[]}
        pendingCount={pendingCount}
      />
    </I18nProvider>,
  )

  return { listOpenGitHubIssues, fetchGitHubIssue, enqueueTask, runPendingTask, ...view }
}

/**
 * The detail footer's run control is a split button (default: Run single). Switch
 * it to the "Add to queue" mode via the caret dropdown, then click the primary.
 */
function clickAddToQueue() {
  fireEvent.click(screen.getByRole('button', { name: 'Choose Add to queue or Run single' }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Add to queue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add to queue' }))
}

describe('IssueTab', () => {
  beforeEach(() => {
    resetAppStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('loads open issue list and shows workflow selector after selection', async () => {
    renderIssueTab()
    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    expect(screen.getByText('Task body')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run single' })).toBeTruthy()
  })

  it('renders issue body markdown as preview', async () => {
    const fetchGitHubIssue = vi.fn<OrbitBridge['fetchGitHubIssue']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 360,
      title: 'Challenge concurrency',
      body: '## Summary\n\n**max three** concurrent runs.\n\n- same goal\n- different goal',
      url: 'https://github.com/guilz-dev/planetz/issues/360',
      state: 'open',
      labels: ['enhancement'],
      author: 'kaz',
    }))
    const listOpenGitHubIssues = vi.fn<OrbitBridge['listOpenGitHubIssues']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [createListItem(360, 'Challenge concurrency')],
      pageInfo: { endCursor: null, hasNextPage: false },
    }))
    renderIssueTab({ fetchGitHubIssue, listOpenGitHubIssues })

    await waitFor(() => {
      expect(screen.getByText('Challenge concurrency')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /Challenge concurrency/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Summary' })).toBeTruthy()
    })
    expect(screen.getByText('max three')).toBeTruthy()
    expect(screen.getByText('same goal')).toBeTruthy()
    expect(screen.queryByText('## Summary')).toBeNull()
  })

  it('shows inline error when list loading fails', async () => {
    const listOpenGitHubIssues = vi.fn(async () => {
      throw new Error('[github-issue:gh_auth_required] not authenticated')
    })
    renderIssueTab({ listOpenGitHubIssues })

    await waitFor(() => {
      expect(screen.getByText('GitHub CLI is not authenticated.')).toBeTruthy()
    })
  })

  it('uses next and previous pagination with cached pages', async () => {
    const listOpenGitHubIssues = vi
      .fn<OrbitBridge['listOpenGitHubIssues']>()
      .mockResolvedValueOnce({
        repository: { owner: 'guilz-dev', name: 'planetz' },
        items: [createListItem(368, 'Page1 issue')],
        pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
      })
      .mockResolvedValueOnce({
        repository: { owner: 'guilz-dev', name: 'planetz' },
        items: [createListItem(367, 'Page2 issue')],
        pageInfo: { endCursor: null, hasNextPage: false },
      })
    renderIssueTab({ listOpenGitHubIssues })

    await waitFor(() => {
      expect(screen.getByText('Page1 issue')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(screen.getByText('Page2 issue')).toBeTruthy()
    })
    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(nextButton.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await waitFor(() => {
      expect(screen.getByText('Page1 issue')).toBeTruthy()
    })
    expect(listOpenGitHubIssues).toHaveBeenCalledTimes(2)
  })

  it('disables single run when pending tasks exist', async () => {
    renderIssueTab({}, 2)
    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    const runSingle = screen.getByRole('button', { name: 'Run single' })
    expect(runSingle.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/2 pending task/)).toBeTruthy()
  })

  it('enqueue then runPendingTask on single run when pending is zero', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-from-issue' }))
    const runPendingTask = vi.fn(async () => {})
    renderIssueTab({ enqueueTask, runPendingTask }, 0)

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run single' }))

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
      expect(runPendingTask).toHaveBeenCalledWith({ taskId: 'task-from-issue' })
    })
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        issueRef: 'guilz-dev/planetz#368',
        issueNumber: 368,
        workflowMode: 'manual',
        workflow: 'default',
        title: '[guilz-dev/planetz#368] Detail issue 368',
      }),
    )
  })

  it('keeps actions disabled while runPendingTask is in flight', async () => {
    const enqueueDeferred = createDeferred<{ taskId: string }>()
    const runDeferred = createDeferred<void>()
    const enqueueTask = vi.fn(() => enqueueDeferred.promise)
    const runPendingTask = vi.fn(() => runDeferred.promise)
    renderIssueTab({ enqueueTask, runPendingTask }, 0)

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run single' }))

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole('button', { name: 'Run single' }).hasAttribute('disabled')).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Choose Add to queue or Run single' })
        .hasAttribute('disabled'),
    ).toBe(true)

    enqueueDeferred.resolve({ taskId: 'task-from-issue' })

    await waitFor(() => {
      expect(runPendingTask).toHaveBeenCalledWith({ taskId: 'task-from-issue' })
    })

    expect(screen.getByRole('button', { name: 'Run single' }).hasAttribute('disabled')).toBe(true)

    runDeferred.resolve()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run single' }).hasAttribute('disabled')).toBe(
        false,
      )
    })
  })

  it('ignores stale issue detail when a newer selection completes first', async () => {
    const fetchDeferred368 = createDeferred<GitHubIssueView>()
    const fetchDeferred367 = createDeferred<GitHubIssueView>()
    const listOpenGitHubIssues = vi.fn<OrbitBridge['listOpenGitHubIssues']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [createListItem(368, 'Issue 368'), createListItem(367, 'Issue 367')],
      pageInfo: { endCursor: null, hasNextPage: false },
    }))
    const fetchGitHubIssue = vi.fn<OrbitBridge['fetchGitHubIssue']>((input) => {
      if (input.ref.endsWith('#368')) return fetchDeferred368.promise
      if (input.ref.endsWith('#367')) return fetchDeferred367.promise
      throw new Error(`unexpected ref: ${input.ref}`)
    })

    renderIssueTab({ listOpenGitHubIssues, fetchGitHubIssue })
    await waitFor(() => {
      expect(screen.getByText('Issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /Issue 368/ }))
    fireEvent.click(screen.getByRole('button', { name: /Issue 367/ }))

    await waitFor(() => {
      expect(fetchGitHubIssue).toHaveBeenCalledTimes(2)
    })

    fetchDeferred367.resolve({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 367,
      title: 'Detail issue 367',
      body: 'Body 367',
      url: 'https://github.com/guilz-dev/planetz/issues/367',
      state: 'open',
      labels: [],
      author: 'kaz',
    })

    await waitFor(() => {
      expect(screen.getByText('Detail issue 367')).toBeTruthy()
    })

    fetchDeferred368.resolve({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Detail issue 368 stale',
      body: 'Body 368',
      url: 'https://github.com/guilz-dev/planetz/issues/368',
      state: 'open',
      labels: [],
      author: 'kaz',
    })

    await waitFor(() => {
      expect(screen.getByText('Detail issue 367')).toBeTruthy()
    })
    expect(screen.queryByText('Detail issue 368 stale')).toBeNull()
  })

  it('reloads issue list and clears selection when workspace changes', async () => {
    const listOpenGitHubIssues = vi
      .fn<OrbitBridge['listOpenGitHubIssues']>()
      .mockResolvedValueOnce({
        repository: { owner: 'guilz-dev', name: 'planetz' },
        items: [createListItem(368, 'WorkspaceA issue')],
        pageInfo: { endCursor: null, hasNextPage: false },
      })
      .mockResolvedValueOnce({
        repository: { owner: 'guilz-dev', name: 'planetz' },
        items: [createListItem(12, 'WorkspaceB issue')],
        pageInfo: { endCursor: null, hasNextPage: false },
      })

    const view = renderIssueTab({ listOpenGitHubIssues }, 0, '/tmp/workspace-a')
    await waitFor(() => {
      expect(screen.getByText('WorkspaceA issue')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /WorkspaceA issue/ }))
    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    view.rerender(
      <I18nProvider>
        <IssueTab
          workspacePath="/tmp/workspace-b"
          workflows={[DEFAULT_WORKFLOW]}
          recentWorkflowNames={[]}
          pendingCount={0}
        />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('WorkspaceB issue')).toBeTruthy()
    })
    expect(screen.queryByText('Detail issue 368')).toBeNull()
    expect(listOpenGitHubIssues).toHaveBeenCalledTimes(2)
  })

  it('enqueues without confirm when only pending tasks match the issue', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-from-issue' }))
    renderIssueTab({ enqueueTask }, 0, '/tmp/workspace-a', [
      createPendingTaskForIssue(368, 'Detail issue 368'),
    ])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    clickAddToQueue()

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText('Run another task for this issue?')).toBeNull()
  })

  it('shows running spinner on list rows with matching running tasks', async () => {
    renderIssueTab({}, 0, '/tmp/workspace-a', [createRunningTaskForIssue(368, 'Detail issue 368')])

    await waitFor(() => {
      expect(screen.getByLabelText('Issue #368 is running')).toBeTruthy()
    })
  })

  it('shows task history badge when the issue has related tasks', async () => {
    renderIssueTab({}, 0, '/tmp/workspace-a', [createCompletedTaskForIssue(368, 'Done once')])

    await waitFor(() => {
      expect(screen.getByText('Tasks 1')).toBeTruthy()
    })
  })

  it('does not enqueue when duplicate-run confirm is cancelled', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-from-issue' }))
    renderIssueTab({ enqueueTask }, 0, '/tmp/workspace-a', [
      createRunningTaskForIssue(368, 'Detail issue 368'),
    ])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    clickAddToQueue()

    await waitFor(() => {
      expect(screen.getByText('Run another task for this issue?')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(enqueueTask).not.toHaveBeenCalled()
    })
  })

  it('enqueues after duplicate-run confirm is accepted', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-from-issue' }))
    renderIssueTab({ enqueueTask }, 0, '/tmp/workspace-a', [
      createRunningTaskForIssue(368, 'Detail issue 368'),
    ])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    clickAddToQueue()
    fireEvent.click(await screen.findByRole('button', { name: 'Add anyway' }))

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })
  })

  it('refines an issue into Composer Assist with a built source context handoff', async () => {
    const buildComposerSourceContext = vi.fn<OrbitBridge['buildComposerSourceContext']>(
      async () => ({
        sourceContext: '## Issue guilz-dev/planetz#368\nDetail issue 368',
      }),
    )
    renderIssueTab({ buildComposerSourceContext })

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Refine in Composer' }))

    await waitFor(() => {
      expect(buildComposerSourceContext).toHaveBeenCalledWith({
        kind: 'issue',
        ref: 'guilz-dev/planetz#368',
      })
    })

    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.activeView).toBe('task')
      expect(state.panelVisibility.composer).toBe(true)
      expect(state.composerAssistHandoff).toEqual({
        sourceContext: '## Issue guilz-dev/planetz#368\nDetail issue 368',
        workflow: 'default',
        issueRef: 'guilz-dev/planetz#368',
      })
    })
  })

  it('shows an inline error when building the source context fails', async () => {
    const buildComposerSourceContext = vi.fn<OrbitBridge['buildComposerSourceContext']>(
      async () => {
        throw new Error('gh fetch failed')
      },
    )
    renderIssueTab({ buildComposerSourceContext })

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Refine in Composer' }))

    await waitFor(() => {
      expect(screen.getByText('Could not load the issue for Composer. Try again.')).toBeTruthy()
    })
    // Handoff is not set and the view stays on the issue tab.
    expect(useAppStore.getState().composerAssistHandoff).toBeNull()
  })

  it('disables Run single while the issue already has a running task', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'task-from-issue' }))
    const runPendingTask = vi.fn(async () => {})
    renderIssueTab({ enqueueTask, runPendingTask }, 0, '/tmp/workspace-a', [
      createRunningTaskForIssue(368, 'Detail issue 368'),
    ])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    const runSingle = screen.getByRole('button', { name: 'Run single' })
    expect(runSingle.hasAttribute('disabled')).toBe(true)
    fireEvent.click(runSingle)
    expect(enqueueTask).not.toHaveBeenCalled()
    expect(runPendingTask).not.toHaveBeenCalled()
  })

  it('quick-enqueues a list issue with Auto workflow from the hover action', async () => {
    const enqueueTask = vi.fn<OrbitBridge['enqueueTask']>(async () => ({
      taskId: 'task-from-issue',
    }))
    const fetchGitHubIssue = vi.fn<OrbitBridge['fetchGitHubIssue']>(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Detail issue 368',
      body: 'Issue body',
      url: 'https://github.com/guilz-dev/planetz/issues/368',
      state: 'open',
      labels: ['enhancement'],
      author: 'kaz',
    }))
    renderIssueTab({ enqueueTask, fetchGitHubIssue })

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Add issue #368 to queue with Auto workflow' }),
    )

    // The one-tap quick action is now guarded behind a confirm modal.
    fireEvent.click(await screen.findByRole('button', { name: 'Add to queue' }))

    await waitFor(() => {
      expect(fetchGitHubIssue).toHaveBeenCalledWith({ ref: 'guilz-dev/planetz#368' })
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })
    const call = enqueueTask.mock.calls[0]?.[0]
    expect(call?.workflowMode).toBe('auto')
    expect(call?.workflow).toBeUndefined()
    expect(call?.title).toBe('[guilz-dev/planetz#368] Detail issue 368')
  })

  it('does not enqueue when the quick-action confirm is cancelled', async () => {
    const enqueueTask = vi.fn<OrbitBridge['enqueueTask']>(async () => ({
      taskId: 'task-from-issue',
    }))
    const fetchGitHubIssue = vi.fn<OrbitBridge['fetchGitHubIssue']>()
    renderIssueTab({ enqueueTask, fetchGitHubIssue })

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Add issue #368 to queue with Auto workflow' }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(fetchGitHubIssue).not.toHaveBeenCalled()
    expect(enqueueTask).not.toHaveBeenCalled()
  })

  it('hides the list quick action while the issue already has an active task', async () => {
    renderIssueTab({}, 0, '/tmp/workspace-a', [createRunningTaskForIssue(368, 'Detail issue 368')])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    expect(
      screen.queryByRole('button', { name: 'Add issue #368 to queue with Auto workflow' }),
    ).toBeNull()
  })

  it('hides the list quick action while the issue has a queued task', async () => {
    renderIssueTab({}, 0, '/tmp/workspace-a', [createPendingTaskForIssue(368, 'Detail issue 368')])

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    expect(
      screen.queryByRole('button', { name: 'Add issue #368 to queue with Auto workflow' }),
    ).toBeNull()
  })

  it('enqueues with Auto workflow mode when the detail Auto toggle is on', async () => {
    const enqueueTask = vi.fn<OrbitBridge['enqueueTask']>(async () => ({
      taskId: 'task-from-issue',
    }))
    const runPendingTask = vi.fn(async () => {})
    renderIssueTab({ enqueueTask, runPendingTask }, 0)

    await waitFor(() => {
      expect(screen.getByText('List issue 368')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /List issue 368/ }))

    await waitFor(() => {
      expect(screen.getByText('Detail issue 368')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Auto workflow selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run single' }))

    await waitFor(() => {
      expect(enqueueTask).toHaveBeenCalledTimes(1)
    })
    const call = enqueueTask.mock.calls[0]?.[0]
    expect(call?.workflowMode).toBe('auto')
    expect(call?.workflow).toBeUndefined()
  })
})
