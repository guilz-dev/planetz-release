import { describe, expect, it } from 'vitest'
import { advancedSectionToYaml, parseAdvancedSectionYaml } from '../workflow-advanced-section.js'

describe('workflow-advanced-section', () => {
  it('serializes and parses a workflow_config section', () => {
    const value = { max_concurrency: 2 }
    const yaml = advancedSectionToYaml(value)
    expect(parseAdvancedSectionYaml(yaml)).toEqual(value)
  })

  it('returns undefined for empty advanced section input', () => {
    expect(parseAdvancedSectionYaml('')).toBeUndefined()
    expect(parseAdvancedSectionYaml('   \n')).toBeUndefined()
  })
})
