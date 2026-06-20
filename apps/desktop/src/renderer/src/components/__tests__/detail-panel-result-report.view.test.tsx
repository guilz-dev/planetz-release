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

describe('DetailPanel report result display', () => {
  beforeEach(() => {
    installOrbitMock({
      getTaskResult: vi.fn<OrbitBridge['getTaskResult']>(async (input) => ({
        taskId: input.taskId,
        reports: [
          {
            fileName: 'report.md',
            relativePath: 'report.md',
            content: '# Summary\n\nDone.',
          },
        ],
        primaryIndex: 0,
        status: 'ok',
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows pull request link when report bundle loads and result summary includes pullRequest', async () => {
    const task = completedTask({ id: 'task-report-result', title: 'Report task' })
    renderDetailPanel({
      task,
      results: [resultSummaryForTask(task, { pullRequest: SAMPLE_PULL_REQUEST })],
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Summary' })).toBeTruthy()
    })

    const link = screen.getByRole('link', { name: 'PR #42' })
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo/pull/42')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('shows pull request link while report bundle is still loading', async () => {
    let resolveBundle: (value: Awaited<ReturnType<OrbitBridge['getTaskResult']>>) => void
    installOrbitMock({
      getTaskResult: vi.fn<OrbitBridge['getTaskResult']>(
        () =>
          new Promise((resolve) => {
            resolveBundle = resolve
          }),
      ),
    })

    const task = completedTask({ id: 'task-report-result', title: 'Report task' })
    renderDetailPanel({
      task,
      results: [resultSummaryForTask(task, { pullRequest: SAMPLE_PULL_REQUEST })],
    })

    expect(screen.getByText('Loading result…')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'PR #42' })
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo/pull/42')

    resolveBundle!({
      taskId: 'task-report-result',
      reports: [
        {
          fileName: 'report.md',
          relativePath: 'report.md',
          content: '# Summary\n\nDone.',
        },
      ],
      primaryIndex: 0,
      status: 'ok',
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Summary' })).toBeTruthy()
    })
    expect(screen.getByRole('link', { name: 'PR #42' })).toBeTruthy()
  })
})
