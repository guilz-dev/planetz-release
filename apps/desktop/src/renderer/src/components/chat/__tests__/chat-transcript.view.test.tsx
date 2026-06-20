import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { ChatTranscript } from '../chat-transcript'
import type { ChatTurn } from '../chat-types'

describe('ChatTranscript in-flight row', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
  })

  const userTurn: ChatTurn = {
    id: 'user_1',
    role: 'user',
    content: 'Hello',
    createdAt: '2026-06-01T00:00:00.000Z',
  }

  it('renders unified in-flight row with thinking status before stream events', () => {
    render(
      <I18nProvider>
        <ChatTranscript
          turns={[userTurn]}
          inFlightAssistant={{ status: 'thinking', streamingTurn: null }}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('keeps responding header while partial assistant text is visible', () => {
    render(
      <I18nProvider>
        <ChatTranscript
          turns={[userTurn]}
          inFlightAssistant={{
            status: 'responding',
            streamingTurn: {
              id: 'stream_1',
              role: 'assistant',
              text: 'Partial answer',
              activities: [],
            },
          }}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Responding…')).toBeTruthy()
    expect(screen.getByText('Partial answer')).toBeTruthy()
  })

  it('shows tool output in activity list without changing header state', () => {
    render(
      <I18nProvider>
        <ChatTranscript
          turns={[userTurn]}
          inFlightAssistant={{
            status: 'tool_running',
            streamingTurn: {
              id: 'stream_1',
              role: 'assistant',
              text: '',
              activities: [
                { kind: 'tool_use', tool: 'Read', id: 't1' },
                { kind: 'tool_output', tool: 'Read', output: 'file contents' },
              ],
            },
          }}
        />
      </I18nProvider>,
    )

    expect(screen.getAllByText('Running Read…').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Read output/)).toBeTruthy()
  })

  it('shows retrying header during a retry send', () => {
    render(
      <I18nProvider>
        <ChatTranscript
          turns={[userTurn]}
          inFlightAssistant={{ status: 'retrying', streamingTurn: null }}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Retrying…')).toBeTruthy()
  })

  it('keeps responding header when tool_result appears in the activity list', () => {
    render(
      <I18nProvider>
        <ChatTranscript
          turns={[userTurn]}
          inFlightAssistant={{
            status: 'responding',
            streamingTurn: {
              id: 'stream_1',
              role: 'assistant',
              text: 'Done',
              activities: [{ kind: 'tool_result', content: 'ok', isError: false }],
            },
          }}
        />
      </I18nProvider>,
    )

    expect(screen.getAllByText('Responding…').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Tool finished/)).toBeTruthy()
  })
})
