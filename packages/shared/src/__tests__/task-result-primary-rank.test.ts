import { describe, expect, it } from 'vitest'
import { rankTaskReportForPrimary } from '../task-result-primary-rank.js'

describe('rankTaskReportForPrimary', () => {
  it('prefers summary over analysis and plan', () => {
    const summary = rankTaskReportForPrimary({ formatKey: 'summary', fileBaseName: 'summary.md' })
    const analysis = rankTaskReportForPrimary({
      formatKey: 'analysis',
      fileBaseName: 'analysis.md',
    })
    const plan = rankTaskReportForPrimary({ formatKey: 'plan', fileBaseName: 'plan.md' })
    expect(summary).toBeGreaterThan(analysis)
    expect(summary).toBeGreaterThan(plan)
    expect(analysis).toBe(plan)
  })

  it('prefers summary over qa_review', () => {
    const summary = rankTaskReportForPrimary({ formatKey: 'summary', fileBaseName: 'summary.md' })
    const review = rankTaskReportForPrimary({
      formatKey: 'qa_review',
      fileBaseName: 'qa_review.md',
    })
    expect(summary).toBeGreaterThan(review)
  })

  it('treats summary.md as summary when formatKey is missing', () => {
    const rank = rankTaskReportForPrimary({ fileBaseName: 'summary.md' })
    const analysis = rankTaskReportForPrimary({ fileBaseName: 'analysis.md' })
    expect(rank).toBeGreaterThan(analysis)
  })
})
