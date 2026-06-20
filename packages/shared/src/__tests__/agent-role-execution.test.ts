import { describe, expect, it } from 'vitest'
import { resolveAgentRoleExecution } from '../agent-role-execution.js'

describe('resolveAgentRoleExecution', () => {
  it('prefers project override over persona and workspace defaults', () => {
    const resolved = resolveAgentRoleExecution(
      'coder',
      {
        provider: 'openai',
        model: 'gpt-base',
        persona_providers: { coder: { provider: 'openai', model: 'gpt-persona' } },
      },
      { persona_providers: { coder: { provider: 'anthropic', model: 'claude' } } },
    )
    expect(resolved).toEqual({
      provider: 'anthropic',
      model: 'claude',
      source: 'project-override',
    })
  })

  it('uses engine persona_providers when no project override', () => {
    const resolved = resolveAgentRoleExecution(
      'coder',
      {
        provider: 'openai',
        model: 'gpt-base',
        persona_providers: { coder: { provider: 'cursor', model: 'auto' } },
      },
      {},
    )
    expect(resolved).toEqual({
      provider: 'cursor',
      model: 'auto',
      source: 'persona-override',
    })
  })

  it('resolves shorthand persona entry as provider only', () => {
    const resolved = resolveAgentRoleExecution(
      'reviewer',
      { persona_providers: { reviewer: 'codex' } },
      {},
    )
    expect(resolved).toEqual({
      provider: 'codex',
      model: undefined,
      source: 'persona-override',
    })
  })

  it('falls back to workspace default', () => {
    const resolved = resolveAgentRoleExecution('planner', { provider: 'openai', model: 'gpt' }, {})
    expect(resolved).toEqual({
      provider: 'openai',
      model: 'gpt',
      source: 'workspace-default',
    })
  })
})
