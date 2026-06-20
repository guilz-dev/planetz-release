import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { useAppStore } from '../../store/app-store.js'
import { StepActivityLog } from '../step-activity-log.js'

const ENTRY = {
  at: '2026-06-02T12:00:00.000Z',
  kind: 'step' as const,
  text: 'step complete: plan',
}

describe('StepActivityLog', () => {
  beforeEach(() => {
    useAppStore.setState({ uiLanguage: 'en' })
  })

  afterEach(() => {
    cleanup()
    useAppStore.setState({ uiLanguage: 'en' })
  })

  it('localizes completed-step duration in Japanese from structured timing fields', () => {
    useAppStore.setState({ uiLanguage: 'ja' })

    render(
      <I18nProvider>
        <StepActivityLog
          state="past"
          latest={ENTRY}
          history={[ENTRY]}
          completedAt="2026-06-02T12:01:12.000Z"
          durationSec={72}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('1m 12sで完了')).toBeTruthy()
  })

  it('falls back to provided summary when structured completion timing is absent', () => {
    render(
      <I18nProvider>
        <StepActivityLog state="past" latest={ENTRY} history={[ENTRY]} summary="Completed in 48s" />
      </I18nProvider>,
    )

    expect(screen.getByText('Completed in 48s')).toBeTruthy()
  })
})
