import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../constants.js'
import { uiConfigSchema } from '../schemas.js'

describe('DEFAULT_CONFIG', () => {
  it('parses as UiConfig and keeps takt paths aligned with taktDir', () => {
    const parsed = uiConfigSchema.parse(DEFAULT_CONFIG)
    expect(parsed.taktDir).toBe('.takt')
    expect(parsed.taktConfigPath).toBe(`${parsed.taktDir}/config.yaml`)
    expect(parsed.workflowsDir).toBe(`${parsed.taktDir}/workflows`)
    expect(parsed.facetsDir).toBe(`${parsed.taktDir}/facets`)
    expect(parsed.tasksYamlPath).toBe(`${parsed.taktDir}/tasks.yaml`)
    expect(parsed.tasksDir).toBe(`${parsed.taktDir}/tasks`)
    expect(parsed.runsDir).toBe(`${parsed.taktDir}/runs`)
  })
})
