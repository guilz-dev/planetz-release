import type { WorkflowRoutingCatalog } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { finalizeRoutingFallback } from '../session/workflow-auto/routing-fallback.js'
import {
  buildFallbackDecision,
  resolveFallbackWorkflow,
  resolveSafeFallbackWorkflowName,
} from '../session/workflow-auto-fallback.js'

describe('resolveFallbackWorkflow', () => {
  it('prefers default when available', () => {
    expect(
      resolveFallbackWorkflow(
        {
          version: 1,
          groups: ['general'],
          workflows: [{ name: 'other', enabledForAuto: true, routingGroups: ['general'] }],
        },
        ['other', 'default'],
      ),
    ).toBe('default')
  })

  it('uses general-group workflow when default is missing', () => {
    expect(
      resolveFallbackWorkflow(
        {
          version: 1,
          groups: ['general'],
          workflows: [
            { name: 'zeta', enabledForAuto: true, routingGroups: ['general'] },
            { name: 'alpha', enabledForAuto: true, routingGroups: ['general'] },
          ],
        },
        ['zeta', 'alpha'],
      ),
    ).toBe('alpha')
  })

  it('skips excluded workflow names', () => {
    expect(
      resolveFallbackWorkflow(
        {
          version: 1,
          groups: ['general'],
          workflows: [
            { name: 'implement-only', enabledForAuto: true, routingGroups: ['bugfix'] },
            { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
          ],
        },
        ['implement-only', 'default'],
        new Set(['implement-only']),
      ),
    ).toBe('default')
  })

  it('returns null when every available workflow is excluded', () => {
    expect(
      resolveFallbackWorkflow(
        { version: 1, groups: ['general'], workflows: [] },
        ['implement-only'],
        new Set(['implement-only']),
      ),
    ).toBeNull()
  })
})

describe('buildFallbackDecision', () => {
  it('uses catalog routing group instead of always general', () => {
    const decision = buildFallbackDecision('terraform', ['fallback:test'], {
      version: 1,
      groups: ['ops', 'general'],
      workflows: [{ name: 'terraform', enabledForAuto: true, routingGroups: ['ops'] }],
    })
    expect(decision.group).toBe('ops')
  })
})

describe('finalizeRoutingFallback', () => {
  it('ignores excluded preferred workflow', () => {
    const decision = finalizeRoutingFallback(
      {
        version: 1,
        groups: ['general'],
        workflows: [
          { name: 'implement-only', enabledForAuto: true, routingGroups: ['bugfix'] },
          { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
        ],
      },
      ['implement-only', 'default'],
      ['fallback:test'],
      'implement-only',
      undefined,
      new Set(['implement-only']),
    )
    expect(decision.selectedWorkflow).toBe('default')
  })

  it('uses literal default when all available workflows are excluded', () => {
    const decision = finalizeRoutingFallback(
      {
        version: 1,
        groups: ['general'],
        workflows: [{ name: 'implement-only', enabledForAuto: true, routingGroups: ['bugfix'] }],
      },
      ['implement-only'],
      ['fallback:all-rejected'],
      undefined,
      undefined,
      new Set(['implement-only']),
    )
    expect(decision.selectedWorkflow).toBe('default')
    expect(decision.selectedWorkflow).not.toBe('implement-only')
  })
})

describe('resolveSafeFallbackWorkflowName', () => {
  const catalog: WorkflowRoutingCatalog = {
    version: 1,
    groups: ['general', 'bugfix'],
    workflows: [
      { name: 'implement-only', enabledForAuto: true, routingGroups: ['bugfix'] },
      { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
      { name: 'alpha', enabledForAuto: true, routingGroups: ['general'] },
    ],
  }

  it('returns preferred workflow when not excluded', () => {
    expect(
      resolveSafeFallbackWorkflowName({
        catalog,
        availableWorkflowNames: ['alpha', 'default'],
        preferredWorkflow: 'alpha',
      }),
    ).toBe('alpha')
  })

  it('skips excluded preferred and picks next safe fallback', () => {
    expect(
      resolveSafeFallbackWorkflowName({
        catalog,
        availableWorkflowNames: ['implement-only', 'default'],
        preferredWorkflow: 'implement-only',
        excludedWorkflowNames: new Set(['implement-only']),
      }),
    ).toBe('default')
  })

  it('falls back to enabled catalog workflow when default is excluded', () => {
    expect(
      resolveSafeFallbackWorkflowName({
        catalog,
        availableWorkflowNames: ['implement-only'],
        excludedWorkflowNames: new Set(['implement-only', 'default']),
      }),
    ).toBe('alpha')
  })

  it('returns null when every enabled workflow is excluded', () => {
    expect(
      resolveSafeFallbackWorkflowName({
        catalog,
        availableWorkflowNames: ['implement-only', 'default'],
        excludedWorkflowNames: new Set(['implement-only', 'default', 'alpha']),
      }),
    ).toBeNull()
  })
})

describe('finalizeRoutingFallback no-safe-workflow', () => {
  it('adds no-safe-workflow reason when every enabled workflow is excluded', () => {
    const decision = finalizeRoutingFallback(
      {
        version: 1,
        groups: ['general'],
        workflows: [
          { name: 'implement-only', enabledForAuto: true, routingGroups: ['bugfix'] },
          { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
        ],
      },
      ['implement-only', 'default'],
      ['fallback:all-rejected'],
      undefined,
      undefined,
      new Set(['implement-only', 'default']),
    )
    expect(decision.reasonCodes).toContain('fallback:no-safe-workflow')
    expect(decision.selectedWorkflow).toBe('default')
  })
})
