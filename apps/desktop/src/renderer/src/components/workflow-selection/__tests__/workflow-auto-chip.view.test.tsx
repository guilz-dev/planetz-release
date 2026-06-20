import type { AutoWorkflowDecision } from '@planetz/shared'
import { ROUTING_REASON_CODES } from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowAutoPreviewRationale } from '../../../hooks/use-workflow-auto-preview.js'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { useAppStore } from '../../../store/app-store.js'
import { WorkflowAutoChip } from '../workflow-auto-chip.js'

const BASE_DECISION: AutoWorkflowDecision = {
  selectedWorkflow: 'ollama-chat',
  group: 'general',
  confidence: 'medium',
  score: 0.6,
  fallbackApplied: false,
  alternatives: [{ name: 'research', group: 'research', score: 0.4 }],
  reasonCodes: ['match:structure-fit'],
}

const FULL_RATIONALE: WorkflowAutoPreviewRationale = {
  decisionReason: 'Best fit for conversational tasks without code edits.',
  comparedDifferences: ['research is investigation-heavy', 'default is broader'],
  fallbackApplied: false,
  reasonCodes: ['match:structure-fit', 'llm:final-compare'],
}

function renderChip(props: Partial<ComponentProps<typeof WorkflowAutoChip>> = {}) {
  const onRequestFullPreview = vi.fn(async () => {})
  render(
    <I18nProvider>
      <WorkflowAutoChip
        loading={false}
        decision={BASE_DECISION}
        placeholder="Auto placeholder"
        previewPhase="deterministic"
        previewRationale={null}
        hasPrompt
        onRequestFullPreview={onRequestFullPreview}
        onConfirmWorkflow={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  )
  fireEvent.click(screen.getByText(BASE_DECISION.selectedWorkflow))
  return { onRequestFullPreview }
}

describe('WorkflowAutoChip', () => {
  afterEach(() => {
    useAppStore.setState({ uiLanguage: 'en' })
    cleanup()
  })

  it('shows structure match hint without confidence in deterministic phase', () => {
    renderChip({ previewPhase: 'deterministic' })
    expect(screen.getByText('Structure match (preview)')).toBeTruthy()
    expect(screen.queryByText(/medium confidence/i)).toBeNull()
    expect(screen.getByText(/Based on workflow structure matching/i)).toBeTruthy()
    expect(screen.queryByText('Why this workflow')).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm with LLM' })).toBeTruthy()
  })

  it('shows confidence and rationale without confirm button in full phase', () => {
    renderChip({
      previewPhase: 'full',
      previewRationale: FULL_RATIONALE,
    })
    expect(screen.getByText('medium confidence')).toBeTruthy()
    expect(screen.queryByText('Structure match (preview)')).toBeNull()
    expect(screen.getByText('Confirmed with routing LLM.')).toBeTruthy()
    expect(screen.getByText('Why this workflow')).toBeTruthy()
    expect(screen.getByText(FULL_RATIONALE.decisionReason)).toBeTruthy()
    expect(screen.getByText('research is investigation-heavy')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm with LLM' })).toBeNull()
  })

  it('shows single-candidate skip message when full rationale has no LLM text', () => {
    renderChip({
      previewPhase: 'full',
      previewRationale: {
        decisionReason: '',
        comparedDifferences: [],
        fallbackApplied: false,
        reasonCodes: [ROUTING_REASON_CODES.routing.singleCandidate, 'match:structure-fit'],
      },
    })
    expect(
      screen.getByText(/Only one viable candidate; routing LLM comparison was skipped/i),
    ).toBeTruthy()
    expect(screen.getByText(/routing:single-candidate/)).toBeTruthy()
  })

  it('shows fallback warning in full phase', () => {
    renderChip({
      previewPhase: 'full',
      previewRationale: {
        decisionReason: '',
        comparedDifferences: [],
        fallbackApplied: true,
        reasonCodes: ['fallback:default'],
      },
    })
    expect(screen.getByText('Fallback applied')).toBeTruthy()
  })

  it('hides confirm button when prompt is empty', () => {
    renderChip({ hasPrompt: false })
    expect(screen.queryByRole('button', { name: 'Confirm with LLM' })).toBeNull()
  })

  it('hides confidence and rationale when preview phase is null', () => {
    renderChip({ previewPhase: null })
    expect(screen.getByText('Structure match (preview)')).toBeTruthy()
    expect(screen.queryByText(/medium confidence/i)).toBeNull()
    expect(screen.queryByText('Why this workflow')).toBeNull()
  })

  it('uses i18n label for alternative workflow action', () => {
    useAppStore.setState({ uiLanguage: 'ja' })
    renderChip()
    expect(screen.getByRole('button', { name: '使用' })).toBeTruthy()
  })

  it('shows preview error alert when routing preview fails', () => {
    renderChip({ previewError: 'Provider unavailable' })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Routing preview failed')).toBeTruthy()
    expect(screen.getByText('Provider unavailable')).toBeTruthy()
  })
})
