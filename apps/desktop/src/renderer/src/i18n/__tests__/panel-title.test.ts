import { describe, expect, it } from 'vitest'
import { resolvePanelTitle } from '../panel-title.js'

describe('resolvePanelTitle', () => {
  it('prefers skin override over locale catalog', () => {
    expect(resolvePanelTitle('en', { agents: 'Counter' }, 'agents')).toBe('Counter')
  })

  it('falls back to ja catalog when skin has no override', () => {
    expect(resolvePanelTitle('ja', undefined, 'tasks')).toBe('タスク')
  })
})
