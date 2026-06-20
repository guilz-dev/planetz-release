import { describe, expect, it } from 'vitest'
import {
  mergeEngineConfigPassthrough,
  passthroughFromEngineConfig,
} from '../engine-config-passthrough.js'

describe('engine config passthrough helpers', () => {
  it('extracts and merges unknown top-level keys', () => {
    const config = {
      provider: 'anthropic',
      task_poll_interval_ms: 500,
      notification_sound: true,
    }
    expect(passthroughFromEngineConfig(config)).toEqual({
      task_poll_interval_ms: 500,
      notification_sound: true,
    })
    const merged = mergeEngineConfigPassthrough(
      { provider: 'openai' },
      { task_poll_interval_ms: 1000 },
    )
    expect(merged).toEqual({
      provider: 'openai',
      task_poll_interval_ms: 1000,
    })
  })

  it('replaces passthrough keys removed from the patch', () => {
    const config = {
      provider: 'a',
      legacy_flag: true,
      extra: 1,
    }
    const merged = mergeEngineConfigPassthrough(config, { extra: 2 })
    expect(merged).toEqual({ provider: 'a', extra: 2 })
    expect('legacy_flag' in merged).toBe(false)
  })
})
