import { describe, expect, it } from 'vitest'
import {
  ORBIT_INTERACTIVE_CONTRACT_VERSION,
  orbitInteractiveRequestSchema,
  orbitInteractiveResponseSchema,
} from '../orbit-interactive-contract.js'

describe('orbit-interactive-contract', () => {
  it('parses a start request', () => {
    const parsed = orbitInteractiveRequestSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'start',
      snapshot: null,
      payload: {
        cwd: '/workspace',
        workflow: 'default',
        planetzSessionId: 'composer_1',
      },
    })
    expect(parsed.op).toBe('start')
  })

  it('parses start payload with sourceContext', () => {
    const parsed = orbitInteractiveRequestSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'start',
      snapshot: null,
      payload: {
        cwd: '/workspace',
        workflow: 'default',
        planetzSessionId: 'composer_1',
        sourceContext: '## Issue #42',
      },
    })
    expect(parsed.payload?.sourceContext).toBe('## Issue #42')
  })

  it('parses start payload with sessionPolicy', () => {
    const parsed = orbitInteractiveRequestSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      op: 'start',
      snapshot: null,
      payload: {
        cwd: '/workspace',
        workflow: 'default',
        planetzSessionId: 'composer_1',
        sessionPolicy: 'planetz-chat-investigate',
        toolsProfile: 'readonly',
      },
    })
    expect(parsed.payload?.sessionPolicy).toBe('planetz-chat-investigate')
  })

  it('parses snapshot with sessionPolicy on response', () => {
    const parsed = orbitInteractiveResponseSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: 'Hi' },
      nextSnapshot: {
        planetzSessionId: 'composer_1',
        cwd: '/workspace',
        workflowId: 'default',
        provider: 'mock',
        lang: 'en',
        messages: [],
        workflowContext: { name: 'default' },
        systemPrompt: 'system',
        allowedTools: ['Read'],
        sessionPolicy: 'planetz-chat-investigate',
        updatedAt: '2026-05-31T00:00:00.000Z',
      },
    })
    expect(parsed.nextSnapshot?.sessionPolicy).toBe('planetz-chat-investigate')
  })

  it('parses a successful turn response', () => {
    const parsed = orbitInteractiveResponseSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: { kind: 'assistant_message', assistantMessage: 'How can I help?' },
      nextSnapshot: {
        planetzSessionId: 'composer_1',
        cwd: '/workspace',
        workflowId: 'default',
        provider: 'mock',
        lang: 'en',
        messages: [{ role: 'assistant', content: 'How can I help?' }],
        workflowContext: {
          name: 'default',
        },
        systemPrompt: 'system',
        allowedTools: ['Read'],
        updatedAt: '2026-05-31T00:00:00.000Z',
      },
    })
    expect(parsed.ok).toBe(true)
    expect(parsed.result?.kind).toBe('assistant_message')
  })

  it('parses play and accept results', () => {
    const play = orbitInteractiveResponseSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'play',
        task: 'Run tests',
        allowedActions: ['execute', 'save_task'],
      },
      nextSnapshot: null,
    })
    expect(play.result?.kind).toBe('play')
    const accept = orbitInteractiveResponseSchema.parse({
      contractVersion: ORBIT_INTERACTIVE_CONTRACT_VERSION,
      ok: true,
      result: {
        kind: 'accept',
        task: 'Latest assistant',
        allowedActions: ['execute', 'save_task'],
      },
      nextSnapshot: null,
    })
    expect(accept.result?.kind).toBe('accept')
  })
})
