import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { ChatComposerForm } from '../chat-composer-form'

const baseProps = {
  draft: 'Hello',
  onDraftChange: vi.fn(),
  mode: 'interactive' as const,
  onModeChange: vi.fn(),
  workspaceOptions: [{ value: '/repo', label: 'repo' }],
  workspaceValue: '/repo',
  onWorkspaceChange: vi.fn(),
  branchOptions: [{ value: 'main', label: 'main' }],
  branchValue: 'main',
  onBranchChange: vi.fn(),
  providerOptions: [{ value: 'claude-sdk', label: 'Claude' }],
  providerValue: 'claude-sdk',
  onProviderChange: vi.fn(),
  modelOptions: [{ value: 'model', label: 'Model' }],
  modelValue: 'model',
  onModelChange: vi.fn(),
  hasConversation: false,
  sending: false,
  onSend: vi.fn(),
  hideModeSwitcher: true,
}

describe('ChatComposerForm cancel affordance', () => {
  it('shows Cancel only while showCancel is true', () => {
    const onCancelSend = vi.fn()
    const { rerender } = render(
      <I18nProvider>
        <ChatComposerForm {...baseProps} sending showCancel onCancelSend={onCancelSend} />
      </I18nProvider>,
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    expect(onCancelSend).toHaveBeenCalledTimes(1)

    rerender(
      <I18nProvider>
        <ChatComposerForm {...baseProps} sending showCancel={false} onCancelSend={onCancelSend} />
      </I18nProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('hides Cancel when idle even if onCancelSend is provided', () => {
    render(
      <I18nProvider>
        <ChatComposerForm {...baseProps} onCancelSend={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('hides Cancel when send failed and composer shows retry instead', () => {
    render(
      <I18nProvider>
        <ChatComposerForm
          {...baseProps}
          sending={false}
          sendError="Send failed"
          onRetrySend={vi.fn()}
          onCancelSend={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
