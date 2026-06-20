import { describe, expect, it } from 'vitest'
import {
  classifyGroupCandidates,
  inferTargetSurfacesFromPrompt,
  inferTaskRoutingRequirementsFromPrompt,
  normalizePromptForRouting,
} from '../session/workflow-auto-classifier.js'

describe('workflow-auto-classifier', () => {
  it('normalizes prompt text', () => {
    expect(normalizePromptForRouting('  Fix LOGIN bug!!! ')).toBe('fix login bug')
  })

  it('classifies bugfix prompts', () => {
    expect(classifyGroupCandidates('fix login bug in auth')).toContain('bugfix')
  })

  it('falls back to general for empty prompt', () => {
    expect(classifyGroupCandidates('')).toEqual(['general'])
  })
})

describe('inferTargetSurfacesFromPrompt', () => {
  it('detects frontend and backend surfaces from keywords', () => {
    expect(
      inferTargetSurfacesFromPrompt(
        normalizePromptForRouting('Fix React UI component and REST API endpoint'),
      ),
    ).toEqual(expect.arrayContaining(['frontend', 'backend']))
  })

  it('detects infra and security surfaces', () => {
    expect(
      inferTargetSurfacesFromPrompt(
        normalizePromptForRouting('Update terraform pipeline and oauth jwt auth'),
      ),
    ).toEqual(expect.arrayContaining(['infra', 'security']))
  })

  it('falls back to general when no surface keyword matches', () => {
    expect(inferTargetSurfacesFromPrompt('summarize yesterday standup')).toEqual(['general'])
  })
})

describe('inferTaskRoutingRequirementsFromPrompt', () => {
  it('infers target surfaces in fallback requirements', () => {
    const requirements = inferTaskRoutingRequirementsFromPrompt(
      'Add playwright e2e tests for the login API',
    )
    expect(requirements.targetSurfaces).toEqual(expect.arrayContaining(['testing', 'backend']))
  })

  it('treats conditional implementation phrasing as not already decided', () => {
    const requirements = inferTaskRoutingRequirementsFromPrompt(
      'Investigate login failure and implement a fix if needed',
    )
    expect(requirements.implementationAlreadyDecided).toBe(false)
  })

  it('treats explicit implementation phrasing as already decided', () => {
    const requirements = inferTaskRoutingRequirementsFromPrompt('Implement OAuth callback handler')
    expect(requirements.implementationAlreadyDecided).toBe(true)
  })

  it('treats Japanese conditional phrasing as not already decided', () => {
    const requirements = inferTaskRoutingRequirementsFromPrompt('必要なら認証フローを修正する')
    expect(requirements.implementationAlreadyDecided).toBe(false)
  })

  it('does not treat unrelated substrings as testing requirements', () => {
    const requirements = inferTaskRoutingRequirementsFromPrompt('Ship the latest release notes')
    expect(requirements.needsTestWriting).toBe(false)
    expect(requirements.expectedOutput).not.toContain('tests')
  })
})
