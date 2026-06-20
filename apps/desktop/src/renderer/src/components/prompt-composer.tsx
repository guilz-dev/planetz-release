import type { AppState, WorkflowRunOverride } from '@planetz/shared'
import {
  diffExecutionOverrides,
  ENQUEUE_IPC_TIMEOUT_MS,
  type ExecutionProfile,
  formatOllamaExecutionBlockedMessage,
  hasTaskBodyContent,
  normalizeTaskBodyForSubmit,
  type PromptHistoryItem,
  resolveExecutionProfile,
  shouldShowSpecStudioComposerGuide,
  type WorkflowSummary,
} from '@planetz/shared'
import { History, Play, Send, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invalidateProviderModelsCache } from '../hooks/provider-model-candidates-cache.js'
import { useComposerExecutionHint } from '../hooks/use-composer-execution-hint.js'
import { useExecutionOptionSources } from '../hooks/use-execution-option-sources'
import { useWorkflowEnqueueGate } from '../hooks/use-workflow-enqueue-gate.js'
import { useWorkflowRoutingPreview } from '../hooks/use-workflow-routing-preview.js'
import { useI18n, useResolvedPanelTitle } from '../i18n'
import { recordChatToTaskMetric } from '../lib/chat-to-task-metrics.js'
import {
  formatComposerAutoModeHint,
  formatComposerOllamaToolsHint,
  formatComposerStepProviderHint,
} from '../lib/format-composer-execution-hint.js'
import { isMacPlatform } from '../lib/is-mac-platform.js'
import type { PromptComposerRunDraft } from '../lib/prompt-composer-run-draft.js'
import { workflowChangeClearingRunOverride } from '../lib/workflow-change-clearing-run-override.js'
import { mergeRoutingIntoComposerDraft } from '../lib/workflow-low-confidence-gate.js'
import { useAppStore } from '../store/app-store'
import { ComposerAssistPanel } from './composer-assist-panel'
import { AutoDecisionDetail } from './composer-workflow-auto.js'
import { ExecutionProfileFields } from './execution-profile-fields'
import { PanelShell } from './panel-shell'
import { Button } from './ui/button'
import { cn } from './ui/cn.js'
import { Dialog } from './ui/dialog'
import { Textarea } from './ui/input'
import { Popover, PopoverAnchor } from './ui/popover'
import { Tooltip } from './ui/tooltip'
import { LowConfidenceGateDialog } from './workflow-selection/low-confidence-gate-dialog.js'
import { WorkflowSelectionBar } from './workflow-selection/workflow-selection-bar.js'

/** Mac: Command+Enter; Windows/Linux: Ctrl+Enter. */
function isEnqueueShortcut(event: React.KeyboardEvent): boolean {
  if (event.key !== 'Enter' || event.altKey) return false
  return isMacPlatform() ? event.metaKey : event.ctrlKey
}

function enqueueShortcutHint(): string {
  return isMacPlatform() ? '⌘↵' : 'Ctrl+↵'
}

function enqueueShortcutAria(): string {
  return isMacPlatform() ? 'Command+Enter' : 'Control+Enter'
}

const SPEC_STUDIO_COMPOSER_DISMISS_PREFIX = 'planetz.specStudioFirstRunDismissed'
const LEGACY_SPEC_DESK_COMPOSER_DISMISS_PREFIX = 'planetz.specDeskFirstRunDismissed'

function specStudioComposerDismissKey(workspacePath: string): string {
  return `${SPEC_STUDIO_COMPOSER_DISMISS_PREFIX}:${workspacePath}`
}

function readSpecStudioGuideDismissed(workspacePath: string): boolean {
  try {
    const key = specStudioComposerDismissKey(workspacePath)
    if (localStorage.getItem(key) === '1') return true
    const legacyKey = `${LEGACY_SPEC_DESK_COMPOSER_DISMISS_PREFIX}:${workspacePath}`
    return localStorage.getItem(legacyKey) === '1'
  } catch {
    return false
  }
}

function appendTaskBodies(base: string, incoming: string): string {
  const left = normalizeTaskBodyForSubmit(base)
  const right = normalizeTaskBodyForSubmit(incoming)
  if (!hasTaskBodyContent(left)) return right
  if (!hasTaskBodyContent(right)) return left
  return `${left}\n\n${right}`
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export type { PromptComposerRunDraft } from '../lib/prompt-composer-run-draft.js'

interface PromptComposerProps {
  workflows: WorkflowSummary[]
  history: PromptHistoryItem[]
  selectedWorkflow: string
  cliReady?: boolean
  cliGuidance?: string
  builtinWorkflowCategoryOrder?: string[]
  /** Recently used workflow names (newest first) for the workflow combobox Recent group. */
  recentWorkflowNames?: string[]
  /** When set, restrict provider options in advanced overrides. */
  allowedProviders?: ReadonlyArray<string>
  sddOpen?: AppState['sddOpen']
  workspacePath?: string
  sddOpenBannerVisible?: boolean
  className?: string
  onWorkflowChange: (name: string) => void
  onSubmit: (draft: PromptComposerRunDraft) => Promise<void>
  onRunNow?: (draft: PromptComposerRunDraft) => Promise<void>
  onDeleteHistory: (id: string) => void
  onNewWorkflow?: () => void
  onClose?: () => void
  onWorkflowCopied?: (name: string) => void | Promise<void>
}

/** Trimmed overrides for IPC; omits values that match resolved defaults when `resolved` is set. */
export function executionOverridesFromDraft(
  draft: Pick<PromptComposerRunDraft, 'provider' | 'model'>,
  resolved?: ExecutionProfile,
): { provider?: string; model?: string } {
  if (!resolved) {
    const provider = draft.provider?.trim()
    const model = draft.model?.trim()
    return {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    }
  }
  return diffExecutionOverrides({ provider: draft.provider, model: draft.model }, resolved)
}

function executionProfileFieldValues(resolved: ExecutionProfile): {
  provider: string
  model: string
} {
  return {
    provider: resolved.provider?.trim() ?? '',
    model: resolved.model?.trim() ?? '',
  }
}

function executionProfilesMatch(
  fields: { provider: string; model: string },
  resolved: ExecutionProfile,
): boolean {
  const baseline = executionProfileFieldValues(resolved)
  return fields.provider.trim() === baseline.provider && fields.model.trim() === baseline.model
}

export function PromptComposer({
  workflows,
  history,
  selectedWorkflow,
  cliReady = true,
  cliGuidance,
  builtinWorkflowCategoryOrder,
  recentWorkflowNames,
  allowedProviders,
  sddOpen,
  workspacePath,
  sddOpenBannerVisible = false,
  className,
  onWorkflowChange,
  onSubmit,
  onRunNow,
  onDeleteHistory,
  onNewWorkflow,
  onClose,
  onWorkflowCopied,
}: PromptComposerProps) {
  const { t } = useI18n()
  const composerAssistDefaultMode = useAppStore((state) => state.composerAssistDefaultMode)
  const composerTitle = useResolvedPanelTitle('composer')
  const [body, setBody] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [executionProfileCustomized, setExecutionProfileCustomized] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [assistMode, setAssistMode] = useState(composerAssistDefaultMode === 'assist')
  const composerAssistHandoff = useAppStore((state) => state.composerAssistHandoff)
  const setComposerAssistHandoff = useAppStore((state) => state.setComposerAssistHandoff)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const chatToTaskHandoff = useAppStore((state) => state.chatToTaskHandoff)
  const setChatToTaskHandoff = useAppStore((state) => state.setChatToTaskHandoff)
  const [assistSourceContext, setAssistSourceContext] = useState<string | undefined>(undefined)
  const [assistSourceContextRef, setAssistSourceContextRef] = useState<string | undefined>(
    undefined,
  )
  const [assistRestartKey, setAssistRestartKey] = useState(0)
  const [chatToTaskConflict, setChatToTaskConflict] = useState<{
    incomingBody: string
    existingBody: string
  } | null>(null)
  const workflowMode = useAppStore((state) => state.workflowMode)
  const setWorkflowMode = useAppStore((state) => state.setWorkflowMode)
  const lastAutoDecision = useAppStore((state) => state.lastAutoDecision)
  const workflowLowConfidenceGateEnabled = useAppStore(
    (state) => state.workflowLowConfidenceGateEnabled,
  )
  const activeView = useAppStore((state) => state.activeView)
  const [specStudioGuideDismissed, setSpecStudioGuideDismissed] = useState(() => {
    if (!workspacePath) return false
    return readSpecStudioGuideDismissed(workspacePath)
  })
  const [runOverride, setRunOverride] = useState<WorkflowRunOverride | undefined>()
  const routing = useWorkflowRoutingPreview(runOverride)
  const gate = useWorkflowEnqueueGate({
    gateEnabled: workflowLowConfidenceGateEnabled,
    workflowMode,
    routingPreview: routing.routingPreview,
    routingPreviewRef: routing.routingPreviewRef,
    applyRouting: routing.applyRouting,
    lastAutoDecision,
  })
  const [pendingDraft, setPendingDraft] = useState<PromptComposerRunDraft | null>(null)
  const [chatToTaskNotice, setChatToTaskNotice] = useState<string | null>(null)
  const chatToTaskConflictCancelRef = useRef<HTMLButtonElement>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const autoMode = workflowMode === 'auto'
  const executionWorkflowName = autoMode
    ? (routing.routingPreview.confirmedWorkflow ?? lastAutoDecision?.selectedWorkflow ?? 'default')
    : selectedWorkflow
  const hasRunNow = onRunNow != null

  const executionOptions = useExecutionOptionSources({ workflowName: executionWorkflowName })

  const resolvedProfile = useMemo(
    () =>
      resolveExecutionProfile(
        executionOptions.engineConfig,
        undefined,
        executionOptions.workflowDefaults,
      ),
    [executionOptions.engineConfig, executionOptions.workflowDefaults],
  )

  const executionOverrides = useMemo(
    () => executionOverridesFromDraft({ provider, model }, resolvedProfile),
    [provider, model, resolvedProfile],
  )

  const hasOverride = useMemo(
    () =>
      executionProfileCustomized && !executionProfilesMatch({ provider, model }, resolvedProfile),
    [executionProfileCustomized, provider, model, resolvedProfile],
  )

  const handleWorkflowSelectionChange = useCallback(
    (workflow: string) => {
      workflowChangeClearingRunOverride(workflow, setRunOverride, onWorkflowChange)
    },
    [onWorkflowChange],
  )

  useEffect(() => {
    setExecutionProfileCustomized(false)
  }, [])

  // Consume a one-shot Composer Assist handoff (e.g. from the Issue tab): switch to
  // assist mode with the pre-built Source Context, then clear it from the store. A new
  // restart key forces the assist panel to remount and start a fresh (forceNew) session.
  useEffect(() => {
    if (!composerAssistHandoff) return
    const handoff = composerAssistHandoff
    setComposerAssistHandoff(null)
    setAssistSourceContext(handoff.sourceContext)
    setAssistSourceContextRef(handoff.issueRef)
    if (handoff.workflow?.trim()) {
      setWorkflowMode('manual')
      handleWorkflowSelectionChange(handoff.workflow)
    }
    setShowHistory(false)
    setAdvancedOpen(false)
    setAssistMode(true)
    setChatToTaskNotice(null)
    setAssistRestartKey((key) => key + 1)
  }, [
    composerAssistHandoff,
    setComposerAssistHandoff,
    setWorkflowMode,
    handleWorkflowSelectionChange,
  ])

  useEffect(() => {
    if (!chatToTaskHandoff) return
    const incomingBody = normalizeTaskBodyForSubmit(chatToTaskHandoff.body)
    const wasTruncated = chatToTaskHandoff.truncated === true
    if (!hasTaskBodyContent(incomingBody)) {
      recordChatToTaskMetric('chat_to_task_apply_failed')
      setChatToTaskNotice(t('composer.chatToTaskApplyFailed'))
      return
    }

    setChatToTaskHandoff(null)
    const existingBody = normalizeTaskBodyForSubmit(body)
    setSubmitError(null)
    setShowHistory(false)
    setAdvancedOpen(false)
    setAssistMode(false)
    clearAssistSourceContext()
    setChatToTaskNotice(wasTruncated ? t('composer.chatToTaskTruncatedNotice') : null)

    if (!hasTaskBodyContent(existingBody)) {
      setBody(incomingBody)
      return
    }
    if (existingBody === incomingBody) {
      setBody(existingBody)
      return
    }
    setChatToTaskConflict({ incomingBody, existingBody })
    // Intentionally omit `body`: re-run only when handoff changes, not on every keystroke
    // (avoids duplicate apply_failed metrics while a failed handoff is held for retry).
  }, [chatToTaskHandoff, setChatToTaskHandoff, t])

  function retryChatToTaskHandoff() {
    if (!chatToTaskHandoff) return
    recordChatToTaskMetric('chat_to_task_retry')
    const payload = chatToTaskHandoff
    setChatToTaskHandoff(null)
    setChatToTaskNotice(null)
    queueMicrotask(() => setChatToTaskHandoff(payload))
  }

  useEffect(() => {
    if (executionProfileCustomized) return
    const next = executionProfileFieldValues(resolvedProfile)
    setProvider(next.provider)
    setModel(next.model)
  }, [resolvedProfile, executionProfileCustomized])

  function resetExecutionProfileToDefaults() {
    setExecutionProfileCustomized(false)
    const next = executionProfileFieldValues(resolvedProfile)
    setProvider(next.provider)
    setModel(next.model)
  }

  function handleExecutionProfileChange(nextProvider: string, nextModel: string) {
    const nextFields = { provider: nextProvider, model: nextModel }
    setProvider(nextFields.provider)
    setModel(nextFields.model)
    setExecutionProfileCustomized(!executionProfilesMatch(nextFields, resolvedProfile))
    if (submitError) setSubmitError(null)
  }

  const profileSources = useMemo(
    () => ({
      engineConfig: executionOptions.engineConfig,
      catalog: executionOptions.catalog,
      workflowDefaults: executionOptions.workflowDefaults,
      currentProvider: provider,
      currentModel: model,
    }),
    [executionOptions, provider, model],
  )

  function handleRunNowClick() {
    const normalizedBody = normalizeTaskBodyForSubmit(body)
    if (!onRunNow || !hasTaskBodyContent(normalizedBody)) return
    const blocked = blockedExecutionMessage()
    if (blocked) {
      setSubmitError(blocked)
      return
    }
    setBusy(true)
    setSubmitError(null)
    void onRunNow(buildComposerRunDraft(normalizedBody))
      .then(() => {
        setBody('')
        resetExecutionProfileToDefaults()
        const providerId = provider.trim()
        if (providerId) invalidateProviderModelsCache(providerId)
        else invalidateProviderModelsCache()
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to run task now'
        setSubmitError(message)
      })
      .finally(() => setBusy(false))
  }

  function applyHistoryItem(item: PromptHistoryItem) {
    const nextBody = item.body.trim().length > 0 ? item.body : item.title
    setBody(nextBody)
    setSubmitError(null)
    if (item.workflow) {
      setWorkflowMode('manual')
      handleWorkflowSelectionChange(item.workflow)
    }
    setShowHistory(false)
  }

  function buildComposerRunDraft(bodyText: string): PromptComposerRunDraft {
    const routingState = routing.routingPreviewRef.current
    const manualWorkflow = selectedWorkflow
    const hasRunOverride = Boolean(
      runOverride?.stepOverrides.some((o) => Boolean(o.provider) || Boolean(o.model)),
    )
    return {
      body: bodyText,
      workflowMode: assistMode ? 'manual' : workflowMode,
      ...(assistMode || workflowMode === 'manual' ? { workflow: manualWorkflow } : {}),
      ...(routingState.previewToken ? { routingPreviewToken: routingState.previewToken } : {}),
      ...(routingState.promptHash ? { routingPromptHash: routingState.promptHash } : {}),
      ...(routingState.confirmedWorkflow
        ? { confirmedWorkflow: routingState.confirmedWorkflow }
        : {}),
      ...(runOverride ? { runOverride } : {}),
      ...(hasRunOverride ? { workflowSelectionKind: 'modified' as const } : {}),
      ...(workflowMode === 'auto' && !hasRunOverride
        ? { workflowSelectionKind: 'auto' as const }
        : {}),
      ...executionOverrides,
    }
  }

  async function submitDraft(draft: PromptComposerRunDraft) {
    await withTimeout(onSubmit(draft), ENQUEUE_IPC_TIMEOUT_MS, t('composer.enqueueTimeout'))
    setBody('')
    resetExecutionProfileToDefaults()
    setRunOverride(undefined)
    routing.resetRouting()
  }

  const guardPreviewDraft = useMemo((): PromptComposerRunDraft | null => {
    const normalizedBody = normalizeTaskBodyForSubmit(body)
    if (!hasTaskBodyContent(normalizedBody)) return null
    return buildComposerRunDraft(normalizedBody)
  }, [body, buildComposerRunDraft])

  const executionHints = useComposerExecutionHint({
    enabled: cliReady && !assistMode,
    taskProvider: provider,
    workflowYaml: executionOptions.workflowYaml,
    workflowName: executionWorkflowName,
    autoMode,
    guardDraft: guardPreviewDraft,
    recentWorkflowNames: recentWorkflowNames ?? [],
  })

  const executionHintMessages = useMemo(() => {
    const messages: string[] = []
    if (hasOverride && autoMode) {
      messages.push(formatComposerAutoModeHint(t))
    }
    if (executionHints.stepHint) {
      messages.push(formatComposerStepProviderHint(executionHints.stepHint, t))
    }
    if (
      executionHints.ollamaGuard?.action === 'warn' &&
      executionHints.ollamaGuard.issues.length > 0
    ) {
      messages.push(formatComposerOllamaToolsHint(executionHints.ollamaGuard.issues, t))
    }
    if (
      executionHints.ollamaGuard?.action === 'block' &&
      executionHints.ollamaGuard.issues.length > 0
    ) {
      messages.push(
        `${t('composer.executionHint.ollamaBlocked')} ${formatOllamaExecutionBlockedMessage(executionHints.ollamaGuard.issues)}`,
      )
    }
    return messages
  }, [hasOverride, autoMode, executionHints, t])

  const ollamaGuardBlocksSubmit =
    executionHints.ollamaGuard?.action === 'block' && executionHints.ollamaGuard.issues.length > 0

  const showSpecStudioComposerGuide =
    activeView === 'task' &&
    !sddOpenBannerVisible &&
    !specStudioGuideDismissed &&
    sddOpen != null &&
    shouldShowSpecStudioComposerGuide(sddOpen)

  function dismissSpecStudioComposerGuide(): void {
    setSpecStudioGuideDismissed(true)
    if (!workspacePath) return
    try {
      localStorage.setItem(specStudioComposerDismissKey(workspacePath), '1')
    } catch {
      // ignore storage failures
    }
  }

  const ollamaGuardPreviewPending =
    provider.trim() === 'ollama' && executionHints.ollamaGuardLoading

  function blockedExecutionMessage(): string | null {
    if (!cliReady) {
      return cliGuidance?.trim() || t('composer.notReady')
    }
    if (ollamaGuardPreviewPending) {
      return null
    }
    if (ollamaGuardBlocksSubmit) {
      return t('composer.executionHint.ollamaBlocked')
    }
    return null
  }

  const submitDisabled =
    !hasTaskBodyContent(body) || assistMode || ollamaGuardPreviewPending || ollamaGuardBlocksSubmit

  async function enqueueOrder() {
    const normalizedBody = normalizeTaskBodyForSubmit(body)
    if (!hasTaskBodyContent(normalizedBody) || busy) return
    const blocked = blockedExecutionMessage()
    if (blocked) {
      setSubmitError(blocked)
      return
    }
    let draft = buildComposerRunDraft(normalizedBody)
    if (
      workflowLowConfidenceGateEnabled &&
      draft.workflowMode === 'auto' &&
      !draft.confirmedWorkflow
    ) {
      const prep = await gate.prepareForEnqueue({
        body: normalizedBody,
        provider,
        model,
      })
      if (prep.routing) {
        draft = mergeRoutingIntoComposerDraft(draft, prep.routing)
      }
      if (!prep.proceed) {
        setPendingDraft(draft)
        gate.setOpen(true)
        return
      }
    }
    setBusy(true)
    setSubmitError(null)
    try {
      await submitDraft(draft)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue task'
      setSubmitError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await enqueueOrder()
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!isEnqueueShortcut(e)) return
    e.preventDefault()
    void enqueueOrder()
  }

  function handleClose() {
    setAssistMode(false)
    clearAssistSourceContext()
    onClose?.()
  }

  async function handleAssistFinalize(finalBody: string) {
    setAssistMode(false)
    clearAssistSourceContext()
    setSubmitError(null)
    const normalizedBody = normalizeTaskBodyForSubmit(finalBody)
    if (!hasTaskBodyContent(normalizedBody)) return

    const blocked = blockedExecutionMessage()
    if (blocked) {
      setSubmitError(blocked)
      setBody(normalizedBody)
      return
    }

    setBusy(true)
    try {
      await withTimeout(
        onSubmit(buildComposerRunDraft(normalizedBody)),
        ENQUEUE_IPC_TIMEOUT_MS,
        t('composer.enqueueTimeout'),
      )
      setBody('')
      resetExecutionProfileToDefaults()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue task'
      setSubmitError(message)
      setBody(normalizedBody)
    } finally {
      setBusy(false)
    }
  }

  function clearAssistSourceContext() {
    setAssistSourceContext(undefined)
    setAssistSourceContextRef(undefined)
  }

  function handleAssistBackToDirect() {
    setAssistMode(false)
    clearAssistSourceContext()
  }

  function handleChatToTaskConflictReplace() {
    if (!chatToTaskConflict) return
    recordChatToTaskMetric('chat_to_task_conflict_replace')
    setBody(chatToTaskConflict.incomingBody)
    setChatToTaskConflict(null)
  }

  function handleChatToTaskConflictAppend() {
    if (!chatToTaskConflict) return
    recordChatToTaskMetric('chat_to_task_conflict_append')
    setBody(appendTaskBodies(chatToTaskConflict.existingBody, chatToTaskConflict.incomingBody))
    setChatToTaskConflict(null)
  }

  function handleChatToTaskConflictCancel() {
    recordChatToTaskMetric('chat_to_task_conflict_cancel')
    setChatToTaskConflict(null)
  }

  return (
    <>
      <LowConfidenceGateDialog
        open={gate.open}
        decision={gate.gateDecision}
        onCancel={() => {
          gate.closeGate()
          setPendingDraft(null)
        }}
        onChoose={async (workflow) => {
          routing.setConfirmedWorkflow(workflow)
          setWorkflowMode('manual')
          handleWorkflowSelectionChange(workflow)
          gate.closeGate()
          const draftToSubmit = pendingDraft
            ? mergeRoutingIntoComposerDraft(
                { ...pendingDraft, workflowMode: 'manual' as const },
                { ...routing.routingPreviewRef.current, confirmedWorkflow: workflow },
              )
            : null
          setPendingDraft(null)
          if (!draftToSubmit) return
          setBusy(true)
          try {
            await submitDraft(draftToSubmit)
          } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to enqueue task')
          } finally {
            setBusy(false)
          }
        }}
      />
      <PanelShell
        title={composerTitle}
        subtitle="Describe a new task to hand off to an agent"
        className={className}
        onClose={onClose ? handleClose : undefined}
        actions={
          <div className="flex items-center gap-1">
            <Tooltip side="bottom" wide label={t('composer.openSpecStudioTooltip')}>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  leading={<Sparkles size={12} />}
                  disabled={!cliReady}
                  onClick={() => setActiveView('spec-studio')}
                >
                  {t('composer.openSpecStudio')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip side="bottom" wide label={t('composer.assistToggleTooltip')}>
              <span className="inline-flex">
                <Button
                  variant={assistMode ? 'subtle' : 'ghost'}
                  size="sm"
                  leading={<Sparkles size={12} />}
                  disabled={!cliReady}
                  onClick={() => {
                    setAssistMode((value) => {
                      const next = !value
                      if (next) {
                        setAdvancedOpen(false)
                        setShowHistory(false)
                      } else {
                        clearAssistSourceContext()
                      }
                      return next
                    })
                  }}
                >
                  {t('composer.assistToggle')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              side="bottom"
              align="end"
              wide
              label={
                history.length === 0
                  ? t('composer.historyTooltipEmpty')
                  : t('composer.historyTooltip')
              }
            >
              <span className="inline-flex">
                <Button
                  variant={showHistory ? 'subtle' : 'ghost'}
                  size="sm"
                  leading={<History size={12} />}
                  onClick={() => setShowHistory((v) => !v)}
                  disabled={history.length === 0 || assistMode}
                >
                  {t('composer.history')}
                </Button>
              </span>
            </Tooltip>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 flex-1">
          <WorkflowSelectionBar
            workflows={workflows}
            selectedWorkflow={selectedWorkflow}
            onWorkflowChange={handleWorkflowSelectionChange}
            workflowMode={assistMode ? 'manual' : workflowMode}
            onWorkflowModeChange={setWorkflowMode}
            promptBody={body}
            provider={provider}
            model={model}
            disabled={!cliReady || assistMode || busy}
            onNewWorkflow={onNewWorkflow}
            builtinWorkflowCategoryOrder={builtinWorkflowCategoryOrder}
            recentWorkflowNames={recentWorkflowNames}
            runOverride={runOverride}
            onRunOverrideChange={setRunOverride}
            confirmedWorkflow={routing.routingPreview.confirmedWorkflow}
            onConfirmedWorkflowChange={routing.setConfirmedWorkflow}
            onPreviewRoutingChange={routing.onPreviewRoutingChange}
            onWorkflowCopied={onWorkflowCopied}
          />
          {showSpecStudioComposerGuide ? (
            <div
              role="status"
              className="flex items-start justify-between gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-status-info)_45%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-status-info)_10%,var(--color-panel))] px-2.5 py-2 text-[11px] leading-snug text-[var(--color-text)]"
            >
              <div>
                <p className="font-semibold text-[var(--color-status-info)]">
                  {t('sddOpen.composerGuideTitle')}
                </p>
                <p className="mt-0.5">{t('sddOpen.composerGuideBody')}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('sddOpen.composerGuideDismiss')}
                onClick={dismissSpecStudioComposerGuide}
              >
                <X size={12} />
              </Button>
            </div>
          ) : null}
          {autoMode && lastAutoDecision ? (
            <AutoDecisionDetail decision={lastAutoDecision} t={t} />
          ) : null}
          {executionHintMessages.length > 0 ? (
            <div
              role="status"
              className="rounded-md border border-[color-mix(in_oklab,var(--color-status-warn)_45%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-status-warn)_12%,var(--color-panel))] px-2.5 py-2 text-[11px] leading-snug text-[var(--color-text)]"
            >
              <p className="mb-1 font-semibold text-[var(--color-status-warn)]">
                {t('composer.executionHint.title')}
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {executionHintMessages.map((message, index) => (
                  <li key={`${index}-${message.slice(0, 32)}`}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {assistMode ? (
            <ComposerAssistPanel
              key={`assist-${assistRestartKey}`}
              seedBody={body}
              workflow={selectedWorkflow}
              {...executionOverrides}
              sourceContext={assistSourceContext}
              sourceContextRef={assistSourceContextRef}
              disabled={!cliReady}
              onFinalize={handleAssistFinalize}
              onRunNow={
                onRunNow
                  ? async (finalBody) => {
                      setAssistMode(false)
                      clearAssistSourceContext()
                      const normalizedBody = normalizeTaskBodyForSubmit(finalBody)
                      if (!hasTaskBodyContent(normalizedBody)) return
                      const blocked = blockedExecutionMessage()
                      if (blocked) {
                        setSubmitError(blocked)
                        setBody(normalizedBody)
                        return
                      }
                      setBusy(true)
                      try {
                        await onRunNow(buildComposerRunDraft(normalizedBody))
                        setBody('')
                        resetExecutionProfileToDefaults()
                      } catch (error) {
                        const message =
                          error instanceof Error ? error.message : 'Failed to run task now'
                        setSubmitError(message)
                        setBody(normalizedBody)
                      } finally {
                        setBusy(false)
                      }
                    }
                  : undefined
              }
              onBackToDirect={handleAssistBackToDirect}
            />
          ) : (
            <Textarea
              className="flex-1 resize-none"
              placeholder="Describe what you'd like the agent to take on…"
              value={body}
              disabled={!cliReady}
              onChange={(e) => {
                setBody(e.target.value)
                if (submitError) setSubmitError(null)
                if (chatToTaskNotice) setChatToTaskNotice(null)
              }}
              onKeyDown={handleTextareaKeyDown}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            {hasRunNow ? (
              <PopoverAnchor>
                <Button
                  type="button"
                  variant={advancedOpen || hasOverride ? 'subtle' : 'ghost'}
                  size="sm"
                  aria-expanded={advancedOpen}
                  aria-controls="prompt-composer-advanced-fields"
                  disabled={!cliReady || assistMode}
                  leading={<Settings2 size={13} />}
                  trailing={
                    hasOverride ? (
                      <span
                        aria-hidden
                        className="ml-0.5 inline-block size-1.5 rounded-full bg-[var(--color-accent)]"
                      />
                    ) : null
                  }
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  Advanced
                </Button>
                <Popover
                  open={advancedOpen}
                  onClose={() => setAdvancedOpen(false)}
                  placement="top-start"
                  className="w-[20rem]"
                >
                  <div id="prompt-composer-advanced-fields" className="flex flex-col gap-2">
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {t('composer.executionHint.advancedScope')}
                    </p>
                    {executionOptions.workflowDefaultsUnavailable && selectedWorkflow.trim() ? (
                      <p className="text-[11px] text-[var(--color-muted)]">
                        Workflow defaults unavailable; using engine config and catalog only.
                      </p>
                    ) : null}
                    <ExecutionProfileFields
                      providerId="prompt-composer-provider"
                      modelId="prompt-composer-model"
                      modelEmptyLabel="(provider default)"
                      showProviderEmptyOption={!resolvedProfile.provider?.trim()}
                      value={{ provider, model }}
                      sources={profileSources}
                      workflowName={selectedWorkflow}
                      allowedProviders={allowedProviders}
                      disabled={!cliReady || executionOptions.loading}
                      onChange={({ provider: nextProvider, model: nextModel }) => {
                        handleExecutionProfileChange(nextProvider, nextModel)
                      }}
                    />
                  </div>
                </Popover>
              </PopoverAnchor>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {hasRunNow ? (
                <Button
                  type="button"
                  variant="subtle"
                  loading={busy && !assistMode}
                  disabled={submitDisabled}
                  title={assistMode ? t('composer.assistRunNowDisabled') : undefined}
                  leading={<Play size={13} />}
                  onClick={handleRunNowClick}
                >
                  {busy && !assistMode ? t('composer.runNowBusy') : t('composer.runNow')}
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                loading={busy && !assistMode}
                disabled={submitDisabled}
                leading={<Send size={13} />}
                aria-keyshortcuts={busy && !assistMode ? undefined : enqueueShortcutAria()}
                trailing={
                  busy && !assistMode ? null : (
                    <span
                      aria-hidden
                      className="ml-0.5 rounded bg-[color-mix(in_oklab,var(--color-accent-foreground)_18%,transparent)] px-1 py-px text-[10px] font-normal leading-none opacity-90"
                    >
                      {enqueueShortcutHint()}
                    </span>
                  )
                }
              >
                {busy && !assistMode ? t('composer.enqueueBusy') : t('composer.enqueue')}
              </Button>
            </div>
          </div>
          {!cliReady && cliGuidance ? (
            <p className="text-xs text-[var(--color-alert)]">{cliGuidance}</p>
          ) : null}
          {chatToTaskNotice ? (
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  'text-xs',
                  chatToTaskHandoff
                    ? 'text-[var(--color-status-failed)]'
                    : 'text-[var(--color-muted)]',
                )}
                role={chatToTaskHandoff ? 'alert' : undefined}
              >
                {chatToTaskNotice}
              </p>
              {chatToTaskHandoff ? (
                <Button variant="subtle" type="button" size="sm" onClick={retryChatToTaskHandoff}>
                  {t('composer.chatToTaskRetry')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {submitError ? <p className="text-xs text-[var(--color-alert)]">{submitError}</p> : null}
        </form>
        {showHistory && history.length > 0 ? (
          <div className="mt-1 shrink-0 border-t border-[var(--color-border)] pt-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent drafts
            </p>
            <ul className="flex flex-col gap-0.5">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[var(--color-panel-strong)]"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-[var(--color-text)] hover:text-[var(--color-accent)]"
                    onClick={() => applyHistoryItem(item)}
                  >
                    {item.title}
                  </button>
                  <button
                    type="button"
                    className="opacity-0 transition-opacity hover:text-[var(--color-status-failed)] group-hover:opacity-100"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => onDeleteHistory(item.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelShell>
      <Dialog
        open={chatToTaskConflict !== null}
        title={t('composer.chatToTaskConflictTitle')}
        description={t('composer.chatToTaskConflictDescription')}
        size="sm"
        onClose={handleChatToTaskConflictCancel}
        initialFocusRef={chatToTaskConflictCancelRef}
        footer={
          <>
            <Button
              ref={chatToTaskConflictCancelRef}
              variant="ghost"
              type="button"
              onClick={handleChatToTaskConflictCancel}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="subtle" type="button" onClick={handleChatToTaskConflictAppend}>
              {t('composer.chatToTaskConflictAppend')}
            </Button>
            <Button variant="primary" type="button" onClick={handleChatToTaskConflictReplace}>
              {t('composer.chatToTaskConflictReplace')}
            </Button>
          </>
        }
      />
    </>
  )
}
