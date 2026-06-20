import { describe, expect, it } from 'vitest'
import {
  appendArgvUserPositionals,
  appendTaktAgentOverrides,
  taktAddCommand,
  taktRunTaskCommand,
  taktWorkflowDoctorCommand,
} from '../commands.js'

describe('appendArgvUserPositionals', () => {
  it('inserts -- before user positionals', () => {
    expect(appendArgvUserPositionals(['add'], 'prompt')).toEqual(['add', '--', 'prompt'])
  })
})

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

  it('keeps prompts that look like flags after --', () => {
    expect(taktAddCommand('--looks-like-flag')).toEqual(['add', '--', '--looks-like-flag'])
  })
})

describe('taktWorkflowDoctorCommand', () => {
  it('places workflow name after --', () => {
    expect(taktWorkflowDoctorCommand('default')).toEqual(['workflow', 'doctor', '--', 'default'])
  })
})
