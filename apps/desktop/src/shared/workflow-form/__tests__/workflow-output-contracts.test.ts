import { describe, expect, it } from 'vitest'
import {
  OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP,
  OUTPUT_CONTRACT_REPORT_GROUP,
  parseOutputContracts,
  stepHasReportOutputContracts,
} from '../workflow-output-contracts.js'

describe('workflow-output-contracts', () => {
  it('detects report and legacy markdown groups', () => {
    expect(
      stepHasReportOutputContracts({
        output_contracts: { [OUTPUT_CONTRACT_REPORT_GROUP]: [{ format: 'plan', name: 'plan.md' }] },
      }),
    ).toBe(true)
    expect(
      stepHasReportOutputContracts({
        output_contracts: {
          [OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP]: [{ format: 'summary' }],
        },
      }),
    ).toBe(true)
    expect(stepHasReportOutputContracts({})).toBe(false)
  })

  it('parses legacy markdown group rows', () => {
    const rows = parseOutputContracts({
      output_contracts: {
        [OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP]: [{ format: 'summary', name: 'summary.md' }],
      },
    })
    expect(rows).toEqual([
      { group: OUTPUT_CONTRACT_LEGACY_MARKDOWN_GROUP, format: 'summary', name: 'summary.md' },
    ])
  })
})
