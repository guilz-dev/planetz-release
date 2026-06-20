import { describe, expect, it } from 'vitest'
import { parseE2eWindowSize } from '../lib/resolve-e2e-window-size.js'

describe('parseE2eWindowSize', () => {
  it('parses WxH', () => {
    expect(parseE2eWindowSize('1920x1080')).toEqual({ width: 1920, height: 1080 })
  })

  it('rejects invalid values', () => {
    expect(parseE2eWindowSize(undefined)).toBeNull()
    expect(parseE2eWindowSize('')).toBeNull()
    expect(parseE2eWindowSize('1920')).toBeNull()
    expect(parseE2eWindowSize('100x100')).toBeNull()
  })
})
