import { describe, expect, it } from 'vitest'
import {
  formatBootstrapStatusLabel,
  ORBIT_DISPLAY_NAME,
  toDisplayOrbitPath,
} from '../orbit-terminology.js'

describe('toDisplayOrbitPath', () => {
  it('maps takt paths to orbit display paths', () => {
    expect(toDisplayOrbitPath('.takt/config.yaml')).toBe('.planetz/orbit/config.yaml')
    expect(toDisplayOrbitPath('.takt/workflows/foo.yaml')).toBe('.planetz/orbit/workflows/foo.yaml')
    expect(toDisplayOrbitPath('.planetz/config.json')).toBe('.planetz/orbit/config.json')
    expect(toDisplayOrbitPath('.takt-agent-ui/config.json')).toBe('.planetz/orbit/config.json')
    expect(toDisplayOrbitPath('.orbit/workflows/default.yaml')).toBe(
      '.planetz/orbit/workflows/default.yaml',
    )
    expect(toDisplayOrbitPath('.planets/orbit/workflows/default.yaml')).toBe(
      '.planetz/orbit/workflows/default.yaml',
    )
  })
})

describe('formatBootstrapStatusLabel', () => {
  it('maps bootstrap status to display labels', () => {
    expect(formatBootstrapStatusLabel('takt_ready')).toBe(`${ORBIT_DISPLAY_NAME} ready`)
    expect(formatBootstrapStatusLabel('partial_takt')).toBe('setup required')
    expect(formatBootstrapStatusLabel('non_takt')).toBe('sidecar missing')
  })
})
