import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { minimalAppState } from '../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { AppHeader } from '../app-header.js'

function renderHeader(props: Partial<ComponentProps<typeof AppHeader>> = {}) {
  const defaults: ComponentProps<typeof AppHeader> = {
    state: minimalAppState(),
    checkingCli: false,
    onRecheckCli: vi.fn(),
    onOpenSettings: vi.fn(),
    onChangeWorkspace: vi.fn(),
    recentWorkspaces: [],
    onOpenRecentWorkspace: vi.fn(async () => true),
    onRemoveRecentWorkspace: vi.fn(async () => {}),
    panelVisibility: { tasks: true, composer: true },
    panelEntries: [{ id: 'composer', label: 'Composer' }],
    onTogglePanel: vi.fn(),
    onResetPanels: vi.fn(),
  }

  return render(
    <I18nProvider>
      <AppHeader {...defaults} {...props} />
    </I18nProvider>,
  )
}

describe('AppHeader menus', () => {
  afterEach(() => {
    cleanup()
  })

  it('closes workspace menu when view menu opens', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    expect(screen.getByText('Open folder...')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.queryByText('Open folder...')).toBeNull()
    expect(screen.getByText('Panels')).toBeTruthy()
  })

  it('closes view menu when workspace menu opens', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByText('Panels')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    expect(screen.queryByText('Panels')).toBeNull()
    expect(screen.getByText('Open folder...')).toBeTruthy()
  })

  it('keeps workspace menu open when recent workspace switch is skipped', async () => {
    const onOpenRecentWorkspace = vi.fn(async () => false)
    renderHeader({
      recentWorkspaces: [{ path: '/tmp/ws', lastOpenedAt: '2026-06-13T00:00:00.000Z' }],
      onOpenRecentWorkspace,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: '/tmp/ws' }))

    await waitFor(() => {
      expect(onOpenRecentWorkspace).toHaveBeenCalledWith('/tmp/ws')
    })
    expect(screen.getByText('Open folder...')).toBeTruthy()
    expect(screen.getByText('/tmp/ws')).toBeTruthy()
  })
})
