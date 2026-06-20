import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { WorkspaceTabStrip } from '../workspace-tab-strip.js'

function renderStrip(props: Partial<ComponentProps<typeof WorkspaceTabStrip>> = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <WorkspaceTabStrip
        tabs={[
          { path: '/work/a', name: 'a' },
          { path: '/work/b', name: 'b' },
        ]}
        activePath="/work/b"
        workspaceSwitching={false}
        onSelect={onSelect}
        onClose={onClose}
        {...props}
      />
    </I18nProvider>,
  )
  return { onSelect, onClose }
}

describe('WorkspaceTabStrip', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when fewer than two tabs', () => {
    const { container } = render(
      <I18nProvider>
        <WorkspaceTabStrip
          tabs={[{ path: '/work/a', name: 'a' }]}
          activePath="/work/a"
          workspaceSwitching={false}
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('marks active tab with aria-pressed', () => {
    renderStrip()
    const active = screen.getByRole('button', { name: 'b', pressed: true })
    expect(active).toBeTruthy()
    expect(screen.getByRole('button', { name: 'a', pressed: false })).toBeTruthy()
  })

  it('calls onSelect when a tab is clicked', () => {
    const { onSelect } = renderStrip()
    fireEvent.click(screen.getByRole('button', { name: 'a', pressed: false }))
    expect(onSelect).toHaveBeenCalledWith('/work/a')
  })

  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderStrip()
    fireEvent.click(screen.getByRole('button', { name: 'Close b' }))
    expect(onClose).toHaveBeenCalledWith('/work/b')
  })

  it('disables tab buttons while workspace is switching', () => {
    renderStrip({ workspaceSwitching: true })
    expect(
      (screen.getByRole('button', { name: 'a', pressed: false }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'b', pressed: true }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('shows duplicate basename labels with parent suffix', () => {
    render(
      <I18nProvider>
        <WorkspaceTabStrip
          tabs={[
            { path: '/clients/acme/repo', name: 'repo' },
            { path: '/clients/beta/repo', name: 'repo' },
          ]}
          activePath="/clients/beta/repo"
          workspaceSwitching={false}
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.getByRole('button', { name: 'repo · clients/acme', pressed: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'repo · clients/beta', pressed: true })).toBeTruthy()
  })
})
