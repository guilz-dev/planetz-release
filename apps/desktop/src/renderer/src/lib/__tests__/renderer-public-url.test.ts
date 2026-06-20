import { describe, expect, it, vi } from 'vitest'
import { rendererPublicUrl } from '../renderer-public-url.js'

describe('rendererPublicUrl', () => {
  it('joins BASE_URL with a path without a leading slash', () => {
    vi.stubEnv('BASE_URL', './')
    expect(rendererPublicUrl('favicon.svg')).toBe('./favicon.svg')
    expect(rendererPublicUrl('/manta-orbit-idle.gif')).toBe('./manta-orbit-idle.gif')
  })

  it('joins BASE_URL without duplicating slashes', () => {
    vi.stubEnv('BASE_URL', '/app/')
    expect(rendererPublicUrl('manta-orbit-idle.gif')).toBe('/app/manta-orbit-idle.gif')
  })

  it('rejects empty paths', () => {
    vi.stubEnv('BASE_URL', './')
    expect(() => rendererPublicUrl('/')).toThrow(/must not be empty/)
  })
})
