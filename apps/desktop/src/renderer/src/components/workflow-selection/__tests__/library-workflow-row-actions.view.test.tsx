import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { LibraryWorkflowRowActions } from '../library-workflow-row-actions.js'

function renderRow(overrides: Partial<Parameters<typeof LibraryWorkflowRowActions>[0]> = {}) {
  const onUseOnce = vi.fn()
  const onEnableInWorkspace = vi.fn()
  const onCopyToProject = vi.fn()
  render(
    <I18nProvider>
      <LibraryWorkflowRowActions
        displayLabel="Terraform"
        isHighlighted={false}
        onHighlight={vi.fn()}
        onUseOnce={onUseOnce}
        onEnableInWorkspace={onEnableInWorkspace}
        onCopyToProject={onCopyToProject}
        {...overrides}
      />
    </I18nProvider>,
  )
  return { onUseOnce, onEnableInWorkspace, onCopyToProject }
}

describe('LibraryWorkflowRowActions', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls onUseOnce from the primary action', () => {
    const { onUseOnce } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Use once' }))
    expect(onUseOnce).toHaveBeenCalledTimes(1)
  })

  it('exposes enable and copy actions in the overflow menu', () => {
    const { onEnableInWorkspace, onCopyToProject } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enable in workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy to project' }))
    expect(onEnableInWorkspace).toHaveBeenCalledTimes(1)
    expect(onCopyToProject).toHaveBeenCalledTimes(1)
  })
})
