import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportMarkdownContent } from '../report-markdown-content'

describe('ReportMarkdownContent', () => {
  it('renders headings and list items from markdown', () => {
    render(
      <ReportMarkdownContent content={'# Summary\n\nYes, git works.\n\n- item one\n- item two'} />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Summary' })).toBeTruthy()
    expect(screen.getByText('Yes, git works.')).toBeTruthy()
    expect(screen.getByText('item one')).toBeTruthy()
    expect(screen.getByText('item two')).toBeTruthy()
  })
})
