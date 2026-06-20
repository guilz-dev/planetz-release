import type { ConnectionState, WorkflowSummary } from '@planetz/shared'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useWorkspaceActions } from '../use-workspace-actions.js'

function workflowSummary(name: string): WorkflowSummary {
  return {
    name,
    source: 'project',
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  }
}

describe('useWorkspaceActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('toggleWatch starts watch when not running', async () => {
    const startWatch = vi.fn(
      async (): Promise<ConnectionState> => ({
        cli: 'ok',
        watch: 'running',
      }),
    )
    installOrbitMock({ startWatch })

    const { result } = renderHook(() =>
      useWorkspaceActions({
        selectedWorkflow: 'default',
        setSelectedWorkflow: vi.fn(),
        watchRunning: false,
      }),
    )

    await act(async () => {
      await result.current.toggleWatch()
    })

    expect(startWatch).toHaveBeenCalledOnce()
  })

  it('toggleWatch stops watch when running', async () => {
    const stopWatch = vi.fn(
      async (): Promise<ConnectionState> => ({
        cli: 'ok',
        watch: 'stopped',
      }),
    )
    installOrbitMock({ stopWatch })

    const { result } = renderHook(() =>
      useWorkspaceActions({
        selectedWorkflow: 'default',
        setSelectedWorkflow: vi.fn(),
        watchRunning: true,
      }),
    )

    await act(async () => {
      await result.current.toggleWatch()
    })

    expect(stopWatch).toHaveBeenCalledOnce()
  })

  it('refreshWorkflows selects first workflow when current is missing', async () => {
    const setSelectedWorkflow = vi.fn()
    installOrbitMock({
      listWorkflows: vi.fn(async () => [workflowSummary('alpha'), workflowSummary('beta')]),
    })

    const { result } = renderHook(() =>
      useWorkspaceActions({
        selectedWorkflow: 'missing',
        setSelectedWorkflow,
        watchRunning: false,
      }),
    )

    await act(async () => {
      await result.current.refreshWorkflows()
    })

    expect(setSelectedWorkflow).toHaveBeenCalledWith('alpha')
  })
})
