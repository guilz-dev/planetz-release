import { describe, expect, it } from 'vitest'
import { appendTaktAgentOverrides, taktAddCommand, taktRunTaskCommand } from '../takt/commands.js'

describe('appendTaktAgentOverrides', () => {
  it('returns args unchanged when overrides are empty', () => {
    expect(appendTaktAgentOverrides(['--task', 'x', '--workflow', 'default'], {})).toEqual([
      '--task',
      'x',
      '--workflow',
      'default',
    ])
    expect(appendTaktAgentOverrides(['--task', 'x', '--workflow', 'default'], undefined)).toEqual([
      '--task',
      'x',
      '--workflow',
      'default',
    ])
  })

  it('prepends provider and model when both set', () => {
    expect(
      appendTaktAgentOverrides(['--task', 'p', '--workflow', 'wf'], {
        provider: 'mock',
        model: 'm1',
      }),
    ).toEqual(['--provider', 'mock', '--model', 'm1', '--task', 'p', '--workflow', 'wf'])
  })

  it('prepends only provider when model omitted', () => {
    expect(
      appendTaktAgentOverrides(['--task', 'p', '--workflow', 'wf'], { provider: 'codex' }),
    ).toEqual(['--provider', 'codex', '--task', 'p', '--workflow', 'wf'])
  })

  it('prepends only model when provider omitted', () => {
    expect(
      appendTaktAgentOverrides(['--task', 'p', '--workflow', 'wf'], { model: 'gpt-4.1' }),
    ).toEqual(['--model', 'gpt-4.1', '--task', 'p', '--workflow', 'wf'])
  })
})

describe('taktRunTaskCommand', () => {
  it('builds task args without overrides', () => {
    expect(taktRunTaskCommand('hello', 'default')).toEqual([
      '--task',
      'hello',
      '--workflow',
      'default',
    ])
  })

  it('builds task args with provider and model', () => {
    expect(
      taktRunTaskCommand('hello', 'default', { provider: 'mock', model: 'mock-model' }),
    ).toEqual([
      '--provider',
      'mock',
      '--model',
      'mock-model',
      '--task',
      'hello',
      '--workflow',
      'default',
    ])
  })

  it('builds task args with provider only', () => {
    expect(taktRunTaskCommand('hello', 'wf', { provider: 'claude-sdk' })).toEqual([
      '--provider',
      'claude-sdk',
      '--task',
      'hello',
      '--workflow',
      'wf',
    ])
  })

  it('builds task args with model only', () => {
    expect(taktRunTaskCommand('hello', 'wf', { model: 'gpt-4.1-mini' })).toEqual([
      '--model',
      'gpt-4.1-mini',
      '--task',
      'hello',
      '--workflow',
      'wf',
    ])
  })
})

describe('taktAddCommand', () => {
  it('builds add args without workflow', () => {
    expect(taktAddCommand('hello')).toEqual(['add', '--', 'hello'])
  })

  it('builds add args with workflow path', () => {
    expect(taktAddCommand('hello', '.orbit/workflows/default.yaml')).toEqual([
      'add',
      '--workflow',
      '.orbit/workflows/default.yaml',
      '--',
      'hello',
    ])
  })
})
