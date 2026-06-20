import { describe, expect, it } from 'vitest'
import { flattenMessageKeys } from '../message-tree.js'
import { enMessages } from '../messages/en.js'
import { jaMessages } from '../messages/ja.js'

describe('UI message catalogs', () => {
  it('en and ja expose the same dot keys', () => {
    expect(flattenMessageKeys(jaMessages)).toEqual(flattenMessageKeys(enMessages))
  })

  it('has no empty leaf strings', () => {
    for (const key of flattenMessageKeys(enMessages)) {
      const parts = key.split('.')
      let node: unknown = enMessages
      for (const part of parts) {
        node = (node as Record<string, unknown>)[part]
      }
      expect(typeof node).toBe('string')
      expect((node as string).trim().length).toBeGreaterThan(0)
    }
  })
})
