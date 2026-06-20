import { describe, expect, it } from 'vitest'
import {
  assertOllamaExecutionAllowed,
  evaluateOllamaExecutionGuard,
  OllamaExecutionBlockedError,
} from '../ollama-execution-guard.js'

describe('evaluateOllamaExecutionGuard', () => {
  it('allows non-ollama providers', () => {
    expect(
      evaluateOllamaExecutionGuard({
        provider: 'cursor',
        workflowYaml: 'steps:\n  - name: x\n    edit: true\n',
        guardMode: 'block',
      }).action,
    ).toBe('allow')
  })

  it('blocks incompatible workflow when guard is block', () => {
    expect(() =>
      assertOllamaExecutionAllowed({
        provider: 'ollama',
        workflowYaml: 'steps:\n  - name: x\n    edit: true\n',
        guardMode: 'block',
      }),
    ).toThrow(OllamaExecutionBlockedError)
  })

  it('warns but does not throw when guard is warn', () => {
    const result = assertOllamaExecutionAllowed({
      provider: 'ollama',
      workflowYaml: 'steps:\n  - name: x\n    edit: true\n',
      guardMode: 'warn',
    })
    expect(result.action).toBe('warn')
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('blocks when workflow name is set but yaml is missing', () => {
    expect(() =>
      assertOllamaExecutionAllowed({
        provider: 'ollama',
        workflowYaml: null,
        guardMode: 'block',
        workflowName: 'default',
      }),
    ).toThrow(OllamaExecutionBlockedError)
  })

  it('blocks when workflow yaml cannot be parsed', () => {
    expect(() =>
      assertOllamaExecutionAllowed({
        provider: 'ollama',
        workflowYaml: 'steps: [',
        guardMode: 'block',
      }),
    ).toThrow(OllamaExecutionBlockedError)
  })
})
