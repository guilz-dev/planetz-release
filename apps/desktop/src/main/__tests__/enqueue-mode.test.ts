import { afterEach, describe, expect, it } from 'vitest'
import {
  isEnqueuePackageFallbackAllowed,
  isPendingDirectMigrationEnabled,
  resolveEnqueueMode,
} from '../takt/enqueue-mode.js'

describe('resolveEnqueueMode', () => {
  afterEach(() => {
    delete process.env.PLANETZ_ENQUEUE_MODE
    delete process.env.PLANETZ_MIGRATE_PENDING_TO_DIRECT
    delete process.env.PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK
  })

  it('defaults to takt_add when unset', () => {
    expect(resolveEnqueueMode()).toBe('takt_add')
  })

  it('returns package_writer only for explicit env value', () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'package_writer'
    expect(resolveEnqueueMode()).toBe('package_writer')
  })

  it('falls back to takt_add for unsupported values', () => {
    process.env.PLANETZ_ENQUEUE_MODE = 'unknown'
    expect(resolveEnqueueMode()).toBe('takt_add')
  })
})

describe('isPendingDirectMigrationEnabled', () => {
  afterEach(() => {
    delete process.env.PLANETZ_MIGRATE_PENDING_TO_DIRECT
  })

  it('is false unless PLANETZ_MIGRATE_PENDING_TO_DIRECT=1', () => {
    expect(isPendingDirectMigrationEnabled()).toBe(false)
    process.env.PLANETZ_MIGRATE_PENDING_TO_DIRECT = '1'
    expect(isPendingDirectMigrationEnabled()).toBe(true)
  })
})

describe('isEnqueuePackageFallbackAllowed', () => {
  afterEach(() => {
    delete process.env.PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK
  })

  it('is false unless PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK=1', () => {
    expect(isEnqueuePackageFallbackAllowed()).toBe(false)
    process.env.PLANETZ_ALLOW_ENQUEUE_PACKAGE_FALLBACK = '1'
    expect(isEnqueuePackageFallbackAllowed()).toBe(true)
  })
})
