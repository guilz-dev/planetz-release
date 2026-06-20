import { describe, expect, it } from 'vitest'
import {
  matchRoutingTargetSurfacesFromText,
  promptIncludesRoutingKeyword,
  promptMentionsTesting,
} from '../routing-surface-hints.js'

describe('promptIncludesRoutingKeyword', () => {
  it('matches whole tokens only for single-word keywords', () => {
    expect(promptIncludesRoutingKeyword('add unit test for login', 'test')).toBe(true)
    expect(promptIncludesRoutingKeyword('update latest changelog', 'test')).toBe(false)
  })

  it('matches multi-word phrases via substring', () => {
    expect(promptIncludesRoutingKeyword('run root cause analysis', 'root cause')).toBe(true)
  })
})

describe('promptMentionsTesting', () => {
  it('detects explicit test tokens', () => {
    expect(promptMentionsTesting('add playwright e2e tests')).toBe(true)
  })

  it('does not match test inside unrelated words', () => {
    expect(promptMentionsTesting('ship the latest release notes')).toBe(false)
  })
})

describe('matchRoutingTargetSurfacesFromText', () => {
  it('returns general when no hint matches', () => {
    expect(matchRoutingTargetSurfacesFromText('summarize yesterday standup')).toEqual(['general'])
  })

  it('detects multiple surfaces', () => {
    expect(matchRoutingTargetSurfacesFromText('fix react ui and rest api endpoint')).toEqual(
      expect.arrayContaining(['frontend', 'backend']),
    )
  })
})
