import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { WorkflowFamilyBadges } from '../workflow-family-badges.js'

describe('WorkflowFamilyBadges', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows experimental and deprecated badges for deprecated experimental workflows', () => {
    render(
      <I18nProvider>
        <WorkflowFamilyBadges workflowName="draft" />
      </I18nProvider>,
    )
    expect(screen.getByText('Experimental')).toBeTruthy()
    expect(screen.getByText('Deprecated')).toBeTruthy()
  })

  it('shows consolidation candidate badge for review derivatives', () => {
    render(
      <I18nProvider>
        <WorkflowFamilyBadges workflowName="review-frontend" />
      </I18nProvider>,
    )
    expect(screen.getByText('Consolidation candidate')).toBeTruthy()
  })
})
