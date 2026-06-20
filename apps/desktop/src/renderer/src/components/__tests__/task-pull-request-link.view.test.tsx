import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { TaskPullRequestLink } from '../task-result/task-pull-request-link.js'
import { SAMPLE_PULL_REQUEST } from './detail-panel-test-fixtures.js'

describe('TaskPullRequestLink', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders localized link with external navigation attributes', () => {
    render(
      <I18nProvider>
        <TaskPullRequestLink pullRequest={SAMPLE_PULL_REQUEST} />
      </I18nProvider>,
    )

    const link = screen.getByRole('link', { name: 'PR #42' })
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo/pull/42')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })
})
