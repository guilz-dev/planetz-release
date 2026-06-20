import { describe, expect, it } from 'vitest'
import { parseSkinId } from '../skin-id.js'

describe('parseSkinId', () => {
  it('maps legacy counter pack skin id to default', () => {
    expect(parseSkinId('sushi')).toBe('default')
  })

  it('delegates other values to parseThemeId', () => {
    expect(parseSkinId('nebula')).toBe('nebula')
  })
})
