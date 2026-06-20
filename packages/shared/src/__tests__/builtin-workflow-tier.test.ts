import { describe, expect, it } from 'vitest'
import {
  CORE_BUILTIN_WORKFLOWS,
  getBuiltinWorkflowTierMeta,
  getLibraryPackId,
  isCoreBuiltinWorkflow,
  isSystemTierBuiltinWorkflow,
  LIBRARY_PACKS,
  listCoreBuiltinWorkflowNames,
  PACK_PREFIX_RULES,
  resolveBuiltinWorkflowTier,
} from '../builtin-workflow-tier.js'
import { CHAT_INVESTIGATION_WORKFLOW_NAME } from '../constants.js'

describe('builtin-workflow-tier', () => {
  it('classifies core workflows with presentation metadata', () => {
    const meta = getBuiltinWorkflowTierMeta('minimal')
    expect(meta.tier).toBe('core')
    expect(meta.name).toBe('minimal')
    expect(meta.displayName).toBe('Quick Implement')
    expect(meta.autoPolicy).toBe('always')
    expect(meta.activation).toBe('always')
    expect(isCoreBuiltinWorkflow('default')).toBe(true)
  })

  it('exposes exactly the proposed Core set', () => {
    expect(listCoreBuiltinWorkflowNames()).toHaveLength(10)
    expect(new Set(CORE_BUILTIN_WORKFLOWS.map((w) => w.name)).size).toBe(10)
  })

  it('keeps the canonical name even when a displayName exists (§15.5)', () => {
    const meta = getBuiltinWorkflowTierMeta(' minimal ')
    expect(meta.name).toBe('minimal')
    expect(meta.displayName).toBe('Quick Implement')
    expect(meta.name).not.toBe(meta.displayName)
  })

  it('treats chat-investigation as system via workflow-usage (single source)', () => {
    expect(isSystemTierBuiltinWorkflow(CHAT_INVESTIGATION_WORKFLOW_NAME)).toBe(true)
    const meta = getBuiltinWorkflowTierMeta(CHAT_INVESTIGATION_WORKFLOW_NAME)
    expect(meta.tier).toBe('system')
    expect(meta.activation).toBe('hidden')
    expect(meta.autoPolicy).toBe('never')
    expect(meta.tierReason).toBe('Chat only')
  })

  it('treats ollama-chat as hidden system tier', () => {
    expect(resolveBuiltinWorkflowTier('ollama-chat')).toBe('system')
    expect(getBuiltinWorkflowTierMeta('ollama-chat').activation).toBe('hidden')
  })

  it('assigns explicit library pack and reason', () => {
    const meta = getBuiltinWorkflowTierMeta('terraform')
    expect(meta.tier).toBe('library')
    expect(meta.packId).toBe('infra')
    expect(meta.tierReason).toBe('IaC / infra')
    expect(meta.activation).toBe('workspace-opt-in')
    expect(meta.autoPolicy).toBe('opt-in')
  })

  it('keeps prefix rules and explicit members pointing at declared packs (single source)', () => {
    const declared = new Set(LIBRARY_PACKS.map((pack) => pack.id))
    for (const rule of PACK_PREFIX_RULES) {
      expect(declared.has(rule.packId)).toBe(true)
    }
  })

  it('classifies prefix-driven family members without explicit listing', () => {
    expect(getLibraryPackId('review-frontend')).toBe('review-and-fix')
    expect(getLibraryPackId('review-fix-dual')).toBe('review-and-fix')
    expect(getLibraryPackId('audit-unit')).toBe('audit')
    expect(getLibraryPackId('default-mini')).toBe('mini-variants')
    expect(getLibraryPackId('backend-cqrs')).toBe('backend-advanced')
    expect(getLibraryPackId('backend-cqrs-mini')).toBe('backend-advanced')
    expect(getLibraryPackId('dual-cqrs')).toBe('fullstack-advanced')
    // review-takt-default is explicit so it overrides the broader review- prefix rule.
    expect(getLibraryPackId('review-takt-default')).toBe('takt-dev')
    expect(getLibraryPackId('takt-default')).toBe('takt-dev')
  })

  it('falls back to library tier for unknown workflows (tolerant)', () => {
    const meta = getBuiltinWorkflowTierMeta('some-unlisted-workflow')
    expect(meta.tier).toBe('library')
    expect(meta.packId).toBeUndefined()
  })

  it('keeps review-default in Core, not the review pack', () => {
    expect(resolveBuiltinWorkflowTier('review-default')).toBe('core')
    expect(getLibraryPackId('review-default')).toBeUndefined()
  })

  it('derives packs by heuristic for unlisted derivatives', () => {
    expect(getLibraryPackId('review-something')).toBe('review-and-fix')
    expect(getLibraryPackId('audit-perf')).toBe('audit')
    expect(getLibraryPackId('takt-default-extra')).toBe('takt-dev')
    expect(getLibraryPackId('dual-extra-cqrs')).toBe('fullstack-advanced')
    expect(getLibraryPackId('backend-extra-cqrs')).toBe('backend-advanced')
    expect(getLibraryPackId('something-mini')).toBe('mini-variants')
  })

  it('applies library workflow overlays for display and lifecycle', () => {
    const mini = getBuiltinWorkflowTierMeta('default-mini')
    expect(mini.displayName).toBe('Standard Implement (mini)')
    expect(mini.tierReason).toBe('Shorter variant of default')

    const draft = getBuiltinWorkflowTierMeta('draft')
    expect(draft.lifecycle).toBe('deprecated')
    expect(draft.successorName).toBe('minimal')

    const experimental = getBuiltinWorkflowTierMeta('magi')
    expect(experimental.lifecycle).toBe('experimental')
  })
})
