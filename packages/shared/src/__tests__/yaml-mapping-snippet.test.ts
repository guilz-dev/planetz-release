import { describe, expect, it } from 'vitest'
import { parseYamlMapping, parseYamlSection, valueToYamlText } from '../yaml-mapping-snippet.js'

describe('yaml-mapping-snippet', () => {
  it('round-trips a mapping for passthrough', () => {
    const text = valueToYamlText({ notification_sound: true })
    expect(parseYamlMapping(text)).toEqual({ notification_sound: true })
    expect(parseYamlMapping('')).toEqual({})
  })

  it('treats blank advanced section as undefined', () => {
    expect(parseYamlSection('')).toBeUndefined()
    expect(parseYamlSection('loop_cap: 3')).toEqual({ loop_cap: 3 })
  })
})
