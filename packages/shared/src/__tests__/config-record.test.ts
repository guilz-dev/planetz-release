import { describe, expect, it } from 'vitest'
import { setOrDeleteConfigField } from '../config-record.js'

describe('setOrDeleteConfigField', () => {
  it('sets when hasValue is true and deletes when false', () => {
    const target: Record<string, unknown> = { provider: 'stale', keep: 1 }
    setOrDeleteConfigField(target, 'provider', 'cursor', true)
    expect(target.provider).toBe('cursor')
    setOrDeleteConfigField(target, 'model', 'auto', false)
    expect(target.model).toBeUndefined()
    setOrDeleteConfigField(target, 'provider', undefined, false)
    expect(target.provider).toBeUndefined()
    expect(target.keep).toBe(1)
  })
})
