import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../__tests__/orbit-mock.js'
import { useWorkflowAutoPreview } from '../use-workflow-auto-preview.js'

async function flushDebouncePreview() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800)
  })
}

const deterministicDecision = {
  selectedWorkflow: 'default',
  group: 'general',
  confidence: 'medium' as const,
  score: 0.8,
  fallbackApplied: false,
  alternatives: [],
  reasonCodes: [],
}

describe('useWorkflowAutoPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resets preview phase and rationale after prompt change following full preview', async () => {
    const previewWorkflowAutoRoute = vi
      .fn()
      .mockResolvedValueOnce({
        previewToken: 'token-det',
        promptHash: 'hash-1',
        phase: 'deterministic' as const,
        decision: deterministicDecision,
      })
      .mockResolvedValueOnce({
        previewToken: 'token-full',
        promptHash: 'hash-1',
        phase: 'full' as const,
        decision: {
          ...deterministicDecision,
          confidence: 'high' as const,
          reasonCodes: ['llm:final-compare'],
        },
        audit: {
          version: 1 as const,
          at: '2026-06-13T00:00:00.000Z',
          taskRequirements: {
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'low',
            blockingUnknowns: [],
          },
          candidatePool: [],
          selectedWorkflow: 'default',
          confidence: 'high' as const,
          decisionReason: 'Best structural fit.',
          comparedDifferences: ['lighter than research'],
        },
      })
      .mockResolvedValueOnce({
        previewToken: 'token-det-2',
        promptHash: 'hash-2',
        phase: 'deterministic' as const,
        decision: deterministicDecision,
      })

    installOrbitMock({ previewWorkflowAutoRoute })

    const { result, rerender } = renderHook(
      (props: { title?: string; body?: string }) =>
        useWorkflowAutoPreview({
          enabled: true,
          title: props.title,
          body: props.body,
        }),
      { initialProps: { title: 'Fix bug', body: '' } },
    )

    await flushDebouncePreview()

    expect(result.current.previewPhase).toBe('deterministic')
    expect(result.current.previewRationale).toBeNull()

    await act(async () => {
      await result.current.requestFullPreview()
    })

    expect(result.current.previewPhase).toBe('full')
    expect(result.current.previewRationale).toEqual({
      decisionReason: 'Best structural fit.',
      comparedDifferences: ['lighter than research'],
      fallbackApplied: false,
      reasonCodes: ['llm:final-compare'],
    })

    rerender({ title: 'Fix bug', body: 'updated details' })

    await flushDebouncePreview()

    expect(result.current.previewPhase).toBe('deterministic')
    expect(result.current.previewRationale).toBeNull()
    expect(previewWorkflowAutoRoute).toHaveBeenCalledTimes(3)
  })

  it('reports hasPrompt false when title and body are empty', () => {
    installOrbitMock()
    const { result } = renderHook(() =>
      useWorkflowAutoPreview({
        enabled: true,
        title: '',
        body: '   ',
      }),
    )
    expect(result.current.hasPrompt).toBe(false)
  })

  it('auto-runs full preview for close deterministic results and preserves suggestion', async () => {
    const previewWorkflowAutoRoute = vi
      .fn()
      .mockResolvedValueOnce({
        previewToken: 'token-det',
        promptHash: 'hash-close',
        phase: 'deterministic' as const,
        decision: {
          selectedWorkflow: 'default',
          group: 'general',
          confidence: 'medium' as const,
          score: 0.8,
          fallbackApplied: false,
          alternatives: [{ name: 'minimal', group: 'general', score: 0.72 }],
          reasonCodes: ['match:structure-fit'],
        },
        audit: {
          version: 1 as const,
          at: '2026-06-13T00:00:00.000Z',
          taskRequirements: {
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'low' as const,
            blockingUnknowns: [],
          },
          candidatePool: [],
          selectedWorkflow: 'default',
          confidence: 'medium' as const,
          decisionReason: '',
          comparedDifferences: [],
        },
        libraryAutoSuggestion: {
          workflowName: 'terraform',
          score: 0.42,
          displayName: 'Terraform',
        },
      })
      .mockResolvedValueOnce({
        previewToken: 'token-full',
        promptHash: 'hash-close',
        phase: 'full' as const,
        decision: {
          selectedWorkflow: 'default',
          group: 'general',
          confidence: 'high' as const,
          score: 0.9,
          fallbackApplied: false,
          alternatives: [],
          reasonCodes: ['llm:final-compare'],
        },
        audit: {
          version: 1 as const,
          at: '2026-06-13T00:00:01.000Z',
          taskRequirements: {
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'low' as const,
            blockingUnknowns: [],
          },
          candidatePool: [],
          selectedWorkflow: 'default',
          confidence: 'high' as const,
          decisionReason: 'Confirmed by final compare.',
          comparedDifferences: [],
        },
      })

    installOrbitMock({ previewWorkflowAutoRoute })

    const { result } = renderHook(() =>
      useWorkflowAutoPreview({
        enabled: true,
        body: 'implement feature',
      }),
    )

    await flushDebouncePreview()
    await act(async () => {})

    expect(previewWorkflowAutoRoute).toHaveBeenCalledTimes(2)
    expect(result.current.previewPhase).toBe('full')
    expect(result.current.libraryAutoSuggestion?.workflowName).toBe('terraform')
  })
})
