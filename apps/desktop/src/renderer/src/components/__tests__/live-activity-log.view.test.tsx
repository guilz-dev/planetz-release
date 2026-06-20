import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { LiveActivityLog } from '../live-activity-log.js'

describe('LiveActivityLog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders entries and jump-to-latest when scrolled up', () => {
    render(
      <I18nProvider>
        <LiveActivityLog
          entries={[
            { at: '2026-06-02T10:00:00.000Z', kind: 'thinking', text: 'Planning…' },
            { at: '2026-06-02T10:00:01.000Z', kind: 'tool_use', text: 'Running grep' },
          ]}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Planning…')).toBeTruthy()
    expect(screen.getByText('Running grep')).toBeTruthy()

    const log = screen.getByRole('log', { name: 'Live activity log' })
    Object.defineProperty(log, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(log, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(log, 'scrollTop', { value: 0, writable: true, configurable: true })
    fireEvent.scroll(log)

    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
  })

  it('applies error and warn text tones from entry level', () => {
    render(
      <I18nProvider>
        <LiveActivityLog
          entries={[
            {
              at: '2026-06-02T10:00:00.000Z',
              kind: 'error',
              text: 'Provider failed',
              level: 'error',
            },
            { at: '2026-06-02T10:00:01.000Z', kind: 'status', text: 'Rate limited', level: 'warn' },
          ]}
        />
      </I18nProvider>,
    )

    const log = screen.getByRole('log', { name: 'Live activity log' })
    expect(within(log).getByText('Provider failed').className).toContain('color-status-failed')
    expect(within(log).getByText('Rate limited').className).toContain('color-status-exceeded')
  })

  it('scrolls to bottom when new entries arrive while stuck to bottom', () => {
    const { rerender } = render(
      <I18nProvider>
        <LiveActivityLog
          entries={[{ at: '2026-06-02T10:00:00.000Z', kind: 'text', text: 'First' }]}
        />
      </I18nProvider>,
    )

    const log = screen.getByRole('log', { name: 'Live activity log' })
    let scrollTop = 0
    Object.defineProperty(log, 'scrollHeight', { value: 120, configurable: true })
    Object.defineProperty(log, 'clientHeight', { value: 60, configurable: true })
    Object.defineProperty(log, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
      configurable: true,
    })

    rerender(
      <I18nProvider>
        <LiveActivityLog
          entries={[
            { at: '2026-06-02T10:00:00.000Z', kind: 'text', text: 'First' },
            { at: '2026-06-02T10:00:01.000Z', kind: 'text', text: 'Second' },
          ]}
        />
      </I18nProvider>,
    )

    expect(scrollTop).toBe(120)
  })
})
