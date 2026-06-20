import type { IntentLedgerAuthority, SpecThreadPhase } from '@planetz/shared'
import { useMemo } from 'react'
import { useI18n } from '../../i18n/use-i18n'

export interface SpecStudioChrome {
  title: string
  threads: string
  newSpec: string
  search: string
  decidedIntent: string
  intentWhat: string
  intentWhy: string
  intentOutOfScope: string
  edit: string
  save: string
  cancel: string
  history: string
  changeReason: string
  adrTitle: string
  pending: string
  drift: string
  satisfies: string
  deviates: string
  source: string
  promoted: string
  actionsAdopt: string
  actionsFix: string
  actionsRatify: string
  actionsReverse: string
  settled: string
  noIntentYet: string
  noDecisions: string
  noThreadSelected: string
  supplyApprox: string
  trace: string
  traceEmpty: string
  traceDrift: string
  phaseClarify: string
  phaseDecide: string
  phaseTrace: string
  phaseStepNumbers: [string, string, string]
  phaseTraceDisabledHint: string
  traceEmptyTitle: string
  traceEmptyBody: string
  traceEmptyBackToDecide: string
  nextStep: {
    clarifyTitle: string
    decideTitle: string
    decideAction: string
    traceTitle: string
    traceAction: string
    driftTitle: (count: number) => string
    driftBody: string
    driftAction: string
  }
  traceNoSupply: string
  traceSupplyStale: string
  traceCenterTitle: string
  traceViewInRail: string
  traceOpenTask: string
  openAllDecisions: string
  unanchoredBadge: string
  authorityLabel: Record<IntentLedgerAuthority, string>
  placeholderWhat: string
  placeholderWhy: string
  placeholderOutOfScope: string
  placeholderReason: string
  intentDraftAutoGenerate: string
  intentDraftRegenerate: string
  intentDraftGenerating: string
  intentDraftGeneratedAt: string
  reversibilityCheap: string
  reversibilityExpensive: string
  statusLabel: Record<SpecThreadPhase, string>
}

export function useSpecStudioChrome(): SpecStudioChrome {
  const { t } = useI18n()
  return useMemo<SpecStudioChrome>(
    () => ({
      title: t('specStudio.title'),
      threads: t('specStudio.threads'),
      newSpec: t('specStudio.newSpec'),
      search: t('specStudio.search'),
      decidedIntent: t('specStudio.decidedIntent'),
      intentWhat: t('specStudio.intentWhat'),
      intentWhy: t('specStudio.intentWhy'),
      intentOutOfScope: t('specStudio.intentOutOfScope'),
      edit: t('specStudio.edit'),
      save: t('specStudio.save'),
      cancel: t('specStudio.cancel'),
      history: t('specStudio.history'),
      changeReason: t('specStudio.changeReason'),
      adrTitle: t('specStudio.adrTitle'),
      pending: t('specStudio.pending'),
      drift: t('specStudio.drift'),
      satisfies: t('specStudio.satisfies'),
      deviates: t('specStudio.deviates'),
      source: t('specStudio.source'),
      promoted: t('specStudio.promoted'),
      actionsAdopt: t('specStudio.actionsAdopt'),
      actionsFix: t('specStudio.actionsFix'),
      actionsRatify: t('specStudio.actionsRatify'),
      actionsReverse: t('specStudio.actionsReverse'),
      settled: t('specStudio.settled'),
      noIntentYet: t('specStudio.noIntentYet'),
      noDecisions: t('specStudio.noDecisions'),
      noThreadSelected: t('specStudio.noThreadSelected'),
      supplyApprox: t('specStudio.supplyApprox'),
      trace: t('specStudio.trace'),
      traceEmpty: t('specStudio.traceEmpty'),
      traceDrift: t('specStudio.traceDrift'),
      phaseClarify: t('specStudio.phaseClarify'),
      phaseDecide: t('specStudio.phaseDecide'),
      phaseTrace: t('specStudio.phaseTrace'),
      phaseStepNumbers: [
        t('specStudio.phaseStepNumber1'),
        t('specStudio.phaseStepNumber2'),
        t('specStudio.phaseStepNumber3'),
      ],
      phaseTraceDisabledHint: t('specStudio.phaseTraceDisabledHint'),
      traceEmptyTitle: t('specStudio.traceEmptyTitle'),
      traceEmptyBody: t('specStudio.traceEmptyBody'),
      traceEmptyBackToDecide: t('specStudio.traceEmptyBackToDecide'),
      nextStep: {
        clarifyTitle: t('specStudio.nextStep.clarifyTitle'),
        decideTitle: t('specStudio.nextStep.decideTitle'),
        decideAction: t('specStudio.nextStep.decideAction'),
        traceTitle: t('specStudio.nextStep.traceTitle'),
        traceAction: t('specStudio.nextStep.traceAction'),
        driftTitle: (count: number) => t('specStudio.nextStep.driftTitle', { count }),
        driftBody: t('specStudio.nextStep.driftBody'),
        driftAction: t('specStudio.nextStep.driftAction'),
      },
      traceNoSupply: t('specStudio.traceNoSupply'),
      traceSupplyStale: t('specStudio.traceSupplyStale'),
      traceCenterTitle: t('specStudio.traceCenterTitle'),
      traceViewInRail: t('specStudio.traceViewInRail'),
      traceOpenTask: t('specStudio.traceOpenTask'),
      openAllDecisions: t('specStudio.openAllDecisions'),
      unanchoredBadge: t('views.decisions.unanchoredBadge'),
      authorityLabel: {
        required: t('specStudio.authority.required'),
        designed: t('specStudio.authority.designed'),
        assumed: t('specStudio.authority.assumed'),
        observed: t('specStudio.authority.observed'),
        ratified: t('specStudio.authority.ratified'),
        reversed: t('specStudio.authority.reversed'),
      },
      placeholderWhat: t('specStudio.placeholderWhat'),
      placeholderWhy: t('specStudio.placeholderWhy'),
      placeholderOutOfScope: t('specStudio.placeholderOutOfScope'),
      placeholderReason: t('specStudio.placeholderReason'),
      intentDraftAutoGenerate: t('specStudio.intentDraftAutoGenerate'),
      intentDraftRegenerate: t('specStudio.intentDraftRegenerate'),
      intentDraftGenerating: t('specStudio.intentDraftGenerating'),
      intentDraftGeneratedAt: t('specStudio.intentDraftGeneratedAt'),
      reversibilityCheap: t('specStudio.reversibilityCheap'),
      reversibilityExpensive: t('specStudio.reversibilityExpensive'),
      statusLabel: {
        clarify: t('specStudio.status.clarify'),
        decided: t('specStudio.status.decided'),
        implementing: t('specStudio.status.implementing'),
        drift: t('specStudio.status.drift'),
      },
    }),
    [t],
  )
}
