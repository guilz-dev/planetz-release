import { describe, expect, it } from 'vitest'
import { normalizeTaskStatus } from '../task-status-normalize.js'

describe('normalizeTaskStatus', () => {
  it('maps pr_failed to failed with pr_failed reason', () => {
    expect(normalizeTaskStatus('pr_failed')).toEqual({
      rawStatus: 'pr_failed',
      status: 'failed',
      statusReason: 'pr_failed',
      errorKind: 'pr_creation',
    })
  })

  it('maps unknown status to failed with unknown_status reason', () => {
    expect(normalizeTaskStatus('mystery_status')).toEqual({
      rawStatus: 'mystery_status',
      status: 'failed',
      statusReason: 'unknown_status',
      errorKind: 'unknown',
    })
  })

  it('defaults missing status to pending', () => {
    expect(normalizeTaskStatus(undefined)).toEqual({ rawStatus: 'pending', status: 'pending' })
  })

  it('preserves canonical statuses', () => {
    expect(normalizeTaskStatus('running')).toEqual({ rawStatus: 'running', status: 'running' })
    expect(normalizeTaskStatus('exceeded')).toEqual({
      rawStatus: 'exceeded',
      status: 'exceeded',
      statusReason: 'iteration_exceeded',
    })
  })

  it('treats interrupted and aborted tasks as terminal failed states', () => {
    expect(normalizeTaskStatus('interrupted')).toEqual({
      rawStatus: 'interrupted',
      status: 'failed',
      statusReason: 'interrupted',
    })
    expect(normalizeTaskStatus('aborted')).toEqual({
      rawStatus: 'aborted',
      status: 'failed',
      statusReason: 'workflow_aborted',
    })
  })

  it('maps cancelled to stopped for explicit user stop semantics', () => {
    expect(normalizeTaskStatus('cancelled')).toEqual({
      rawStatus: 'cancelled',
      status: 'stopped',
      statusReason: 'stopped',
    })
  })
})
