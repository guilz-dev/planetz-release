import { describe, expect, it } from 'vitest'
import { BRIDGE_EVENT_METHODS, BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { BRIDGE_REVISION } from '../bridge-revision.js'

describe('BRIDGE_REVISION', () => {
  it('includes event bridge methods so stale preload is detectable in dev', () => {
    for (const method of BRIDGE_EVENT_METHODS) {
      expect(BRIDGE_REVISION).toContain(method)
    }
  })

  it('includes invoke manifest methods', () => {
    for (const entry of BRIDGE_INVOKE_MANIFEST) {
      expect(BRIDGE_REVISION).toContain(entry.method)
    }
  })
})
