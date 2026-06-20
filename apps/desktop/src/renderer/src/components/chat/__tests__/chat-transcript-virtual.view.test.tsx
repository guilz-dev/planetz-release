import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { ChatTranscriptVirtual, shouldVirtualizeChatTranscript } from '../chat-transcript-virtual'
import type { ChatTurn } from '../chat-types'

vi.mock('react-window', () => ({
  VariableSizeList: ({
    children,
    itemCount,
    itemData,
  }: {
    children: (props: {
      index: number
      style: Record<string, never>
      data: typeof itemData
    }) => React.ReactNode
    itemCount: number
    itemData: unknown
  }) => (
    <div data-testid="virtual-list">
      {Array.from({ length: itemCount }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: test mock for static virtual rows
        <div key={index}>{children({ index, style: {}, data: itemData })}</div>
      ))}
    </div>
  ),
}))

describe('ChatTranscriptVirtual', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
  })

  it('virtualizes at the configured turn threshold', () => {
    expect(shouldVirtualizeChatTranscript(49)).toBe(false)
    expect(shouldVirtualizeChatTranscript(50)).toBe(true)
  })

  it('renders a large transcript without throwing', () => {
    const turns: ChatTurn[] = Array.from({ length: 500 }, (_, index) => ({
      id: `turn_${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message body ${index} with some padding for measurement.`,
      createdAt: '2026-06-01T00:00:00.000Z',
    }))

    expect(() =>
      render(
        <I18nProvider>
          <div style={{ height: 480 }}>
            <ChatTranscriptVirtual
              turns={turns}
              inFlightAssistant={null}
              latestAssistantTurnId={null}
            />
          </div>
        </I18nProvider>,
      ),
    ).not.toThrow()
  })

  it('remounts rows when turn content length changes', () => {
    const short: ChatTurn[] = [
      {
        id: 't1',
        role: 'assistant',
        content: 'Short',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]
    const long: ChatTurn[] = [
      {
        id: 't1',
        role: 'assistant',
        content: 'Long '.repeat(200),
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]

    const { rerender } = render(
      <I18nProvider>
        <div style={{ height: 320 }}>
          <ChatTranscriptVirtual
            turns={short}
            inFlightAssistant={null}
            latestAssistantTurnId={null}
          />
        </div>
      </I18nProvider>,
    )

    expect(() =>
      rerender(
        <I18nProvider>
          <div style={{ height: 320 }}>
            <ChatTranscriptVirtual
              turns={long}
              inFlightAssistant={null}
              latestAssistantTurnId={null}
            />
          </div>
        </I18nProvider>,
      ),
    ).not.toThrow()
  })

  it('renders unified in-flight row at the virtualized list tail', () => {
    const turns: ChatTurn[] = Array.from({ length: 50 }, (_, index) => ({
      id: `turn_${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${index}`,
      createdAt: '2026-06-01T00:00:00.000Z',
    }))

    render(
      <I18nProvider>
        <div style={{ height: 480 }}>
          <ChatTranscriptVirtual
            turns={turns}
            inFlightAssistant={{ status: 'thinking', streamingTurn: null }}
            latestAssistantTurnId={null}
          />
        </div>
      </I18nProvider>,
    )

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })
})
