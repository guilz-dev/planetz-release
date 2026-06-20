import { afterEach, describe, expect, it } from 'vitest'
import { isMacPlatform } from '../is-mac-platform.js'

function setNavigator(partial: Partial<Navigator> & { userAgentData?: { platform: string } }) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: partial,
  })
}

describe('isMacPlatform', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
      writable: true,
    })
  })

  it('returns false when navigator is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
      writable: true,
    })
    expect(isMacPlatform()).toBe(false)
  })

  it('prefers userAgentData.platform when available', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0',
      platform: '',
      userAgentData: { platform: 'macOS' },
    })
    expect(isMacPlatform()).toBe(true)
  })

  it('falls back to userAgent when userAgentData is missing', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: '',
    })
    expect(isMacPlatform()).toBe(true)
  })

  it('falls back to legacy platform when userAgent is generic', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0',
      platform: 'MacIntel',
    })
    expect(isMacPlatform()).toBe(true)
  })

  it('returns false for non-Apple platforms', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    })
    expect(isMacPlatform()).toBe(false)
  })
})
