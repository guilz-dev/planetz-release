import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import {
  completedTask,
  renderDetailPanel,
  resultSummaryForTask,
  SAMPLE_PULL_REQUEST,
} from './detail-panel-test-fixtures.js'

describe('DetailPanel external result display', () => {
  beforeEach(() => {
    installOrbitMock({
      getTaskResult: vi.fn<OrbitBridge['getTaskResult']>(async (input) => ({
        taskId: input.taskId,
        reports: [],
        status: 'external',
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps the Result frame visible for external executions', async () => {
    renderDetailPanel({
      task: completedTask({ id: 'task-external-result', title: 'External task' }),
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'This run used an external executor (e.g. Cursor), so there is no structured Orbit facet report.',
        ),
      ).toBeTruthy()
    })

    expect(screen.getByText(/^Result$/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Open in Log' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Open worktree' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'PR #42' })).toBeNull()
  })

  it('shows pull request link when result summary includes pullRequest', async () => {
    const task = completedTask({ id: 'task-external-result', title: 'External task' })
    renderDetailPanel({
      task,
      results: [resultSummaryForTask(task, { pullRequest: SAMPLE_PULL_REQUEST })],
    })

    const link = await screen.findByRole('link', { name: 'PR #42' })
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo/pull/42')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })
})
