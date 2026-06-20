import { type DesktopCapabilitiesResult, resolveChatAgentModeDisabledReason } from '@planetz/shared'
import { Check, ChevronDown, Folder, GitBranch, Send, Sparkles } from 'lucide-react'
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { isMacPlatform } from '../../lib/is-mac-platform.js'
import { ModelFilterCombobox } from '../model-filter-combobox'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Popover, PopoverAnchor } from '../ui/popover'
import { Select } from '../ui/select'
import type { ChatMode, ChatSelectOption } from './chat-types'

export type ChatSendIntent = 'send' | 'finalize'

interface ChatComposerFormProps {
  draft: string
  onDraftChange: (value: string) => void
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  workspaceOptions: ChatSelectOption[]
  workspaceValue: string
  onWorkspaceChange: (value: string) => void
  workspaceRecentOptions?: ChatSelectOption[]
  onWorkspaceBrowse?: () => void
  onWorkspaceOpenRecent?: (path: string) => Promise<void> | void
  onWorkspaceRemoveRecent?: (path: string) => Promise<void> | void
  branchOptions: ChatSelectOption[]
  branchValue: string
  onBranchChange: (value: string) => void
  providerOptions: ChatSelectOption[]
  providerValue: string
  onProviderChange: (value: string) => void
  modelOptions: ChatSelectOption[]
  modelValue: string
  onModelChange: (value: string) => void
  effortOptions?: ChatSelectOption[]
  effortValue?: string
  onEffortChange?: (value: string) => void
  /** True once the active thread has at least one turn (enables Create spec). */
  hasConversation: boolean
  sending: boolean
  canSubmit?: boolean
  disabled?: boolean
  autoFocus?: boolean
  sendError?: string | null
  onRetrySend?: () => void
  onCancelSend?: () => void
  showCancel?: boolean
  onSend: (intent: ChatSendIntent) => void
  chatAgentEnabled?: boolean
  chatAgentSupportByProvider?: DesktopCapabilitiesResult['chatAgentSupportByProvider']
  hideModeSwitcher?: boolean
  placeholder?: string
}

type ChatModeLabelKey = 'chat.modeInteractive' | 'chat.modeAgent' | 'chat.modeSpec'

const ALL_MODES: ReadonlyArray<{ id: ChatMode; labelKey: ChatModeLabelKey }> = [
  { id: 'interactive', labelKey: 'chat.modeInteractive' },
  { id: 'agent', labelKey: 'chat.modeAgent' },
  { id: 'spec', labelKey: 'chat.modeSpec' },
]

function ensureCurrentOption(
  options: ChatSelectOption[],
  value: string,
  fallbackLabel?: string,
): ChatSelectOption[] {
  const trimmed = value.trim()
  if (!trimmed) return options
  if (options.some((option) => option.value === trimmed)) return options
  return [...options, { value: trimmed, label: fallbackLabel?.trim() || trimmed }]
}

function primaryActionLabelKey(mode: ChatMode): ChatModeLabelKey {
  if (mode === 'spec') return 'chat.modeSpec'
  if (mode === 'agent') return 'chat.modeAgent'
  return 'chat.modeInteractive'
}

function isSendShortcut(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || event.altKey || event.shiftKey) return false
  return isMacPlatform() ? event.metaKey : event.ctrlKey
}

/**
 * Bottom-docked / centered composer. Pure presentational: every input is
 * controlled and every action is reported via callbacks (no data fetching).
 */
export function ChatComposerForm({
  draft,
  onDraftChange,
  mode,
  onModeChange,
  workspaceOptions,
  workspaceValue,
  onWorkspaceChange,
  workspaceRecentOptions = [],
  onWorkspaceBrowse,
  onWorkspaceOpenRecent,
  onWorkspaceRemoveRecent,
  branchOptions,
  branchValue,
  onBranchChange,
  providerOptions,
  providerValue,
  onProviderChange,
  modelOptions,
  modelValue,
  onModelChange,
  effortOptions = [],
  effortValue = '',
  onEffortChange,
  hasConversation,
  sending,
  canSubmit = true,
  disabled = false,
  autoFocus = false,
  sendError = null,
  onRetrySend,
  onCancelSend,
  showCancel = false,
  onSend,
  chatAgentEnabled = false,
  chatAgentSupportByProvider,
  hideModeSwitcher = false,
  placeholder,
}: ChatComposerFormProps) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modes = chatAgentEnabled ? ALL_MODES : ALL_MODES.filter((option) => option.id !== 'agent')
  const agentModeDisabledReason = resolveChatAgentModeDisabledReason({
    provider: providerValue,
    chatAgentEnabled,
    chatAgentSupportByProvider,
  })
  const trimmedEmpty = draft.trim().length === 0
  const sendDisabled = disabled || sending || trimmedEmpty || !canSubmit
  const specPrimary = mode === 'spec' && hasConversation
  const resolvedProviderOptions = ensureCurrentOption(providerOptions, providerValue)
  const resolvedWorkspaceOptions = ensureCurrentOption(workspaceOptions, workspaceValue)
  const resolvedBranchOptions = ensureCurrentOption(branchOptions, branchValue)

  // Auto-grow: match the textarea height to its content so newlines expand the
  // box (capped by max-height in the class list, then it scrolls).
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft drives the re-measure even though the body reads it via the DOM
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isSendShortcut(event)) return
    event.preventDefault()
    if (!sendDisabled) onSend('send')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sendError ? (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-[var(--color-danger, #f87171)]">
          <span className="min-w-0 flex-1">{sendError}</span>
          {onRetrySend ? (
            <Button type="button" variant="subtle" size="sm" onClick={onRetrySend}>
              {t('chat.retrySend')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {/* Bordered card — same recipe as PanelShell (Add Task) so it stays
          visible on low-contrast skins like Macchiato where the elevated fill
          barely differs from the background. No focus-within glow; the caret
          alone signals textarea focus. */}
      <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-2 shadow-lg shadow-black/20">
        <textarea
          ref={textareaRef}
          // biome-ignore lint/a11y/noAutofocus: opt-in via prop for new-chat focus UX
          autoFocus={autoFocus}
          value={draft}
          disabled={disabled}
          rows={1}
          placeholder={placeholder ?? t('chat.composerPlaceholder')}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="block max-h-48 min-h-[3.5rem] w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
          <span className="ml-auto" />

          <Select
            aria-label={t('chat.providerAria')}
            value={providerValue}
            disabled={disabled}
            className="h-7 max-w-[10rem] text-xs"
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {resolvedProviderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <ModelFilterCombobox
            ariaLabel={t('chat.modelAria')}
            options={modelOptions}
            value={modelValue}
            disabled={disabled}
            className="h-7 max-w-[11rem] text-xs"
            onChange={onModelChange}
          />
          {effortOptions.length > 0 ? (
            <ModelFilterCombobox
              ariaLabel={t('chat.effortAria')}
              options={effortOptions}
              value={effortValue}
              disabled={disabled}
              placeholder={t('chat.effortPlaceholder')}
              searchPlaceholder={t('chat.effortPlaceholder')}
              emptyLabel={t('chat.effortEmpty')}
              className="h-7 max-w-[8rem] text-xs"
              onChange={onEffortChange ?? (() => {})}
            />
          ) : null}

          {specPrimary ? (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              disabled={sendDisabled}
              onClick={() => onSend('send')}
            >
              {t('chat.send')}
            </Button>
          ) : null}

          {/* Split button: primary action + mode (Chat / Spec) dropdown caret. */}
          {hideModeSwitcher ? (
            <div className="inline-flex items-center gap-2">
              {showCancel && onCancelSend ? (
                <Button type="button" variant="subtle" size="sm" onClick={onCancelSend}>
                  {t('chat.cancelSend')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={sending}
                disabled={specPrimary ? disabled || sending : sendDisabled}
                leading={mode === 'spec' ? <Sparkles size={13} /> : <Send size={13} />}
                onClick={() => {
                  if (sending) return
                  onSend(specPrimary ? 'finalize' : 'send')
                }}
                className={cn(!specPrimary && 'min-w-[5rem]')}
              >
                {sending ? t('chat.sending') : t(primaryActionLabelKey(mode))}
              </Button>
            </div>
          ) : (
            <PopoverAnchor>
              <div className="inline-flex items-stretch gap-2">
                {showCancel && onCancelSend ? (
                  <Button type="button" variant="subtle" size="sm" onClick={onCancelSend}>
                    {t('chat.cancelSend')}
                  </Button>
                ) : null}
                <div className="inline-flex items-stretch">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={sending}
                    disabled={specPrimary ? disabled || sending : sendDisabled}
                    leading={mode === 'spec' ? <Sparkles size={13} /> : <Send size={13} />}
                    onClick={() => {
                      if (sending) return
                      onSend(specPrimary ? 'finalize' : 'send')
                    }}
                    className={cn('rounded-r-none', !specPrimary && 'min-w-[5rem]')}
                  >
                    {sending ? t('chat.sending') : t(primaryActionLabelKey(mode))}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    aria-label={t('chat.modeAria')}
                    aria-haspopup="menu"
                    aria-expanded={modeMenuOpen}
                    disabled={disabled || sending}
                    onClick={() => setModeMenuOpen((open) => !open)}
                    className="rounded-l-none border-l border-black/15 px-1.5"
                  >
                    <ChevronDown size={13} />
                  </Button>
                </div>
                <Popover
                  open={modeMenuOpen}
                  onClose={() => setModeMenuOpen(false)}
                  placement="top-end"
                  className="min-w-[9rem] gap-0.5 p-1"
                >
                  {modes.map((option) => {
                    const active = mode === option.id
                    const modeDisabled = option.id === 'agent' && agentModeDisabledReason !== null
                    const disabledTitle =
                      agentModeDisabledReason === 'ollama'
                        ? t('chat.modeAgentDisabledOllama')
                        : agentModeDisabledReason === 'provider'
                          ? t('chat.modeAgentDisabled')
                          : undefined
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        disabled={modeDisabled}
                        title={modeDisabled ? disabledTitle : undefined}
                        onClick={() => {
                          if (modeDisabled) return
                          onModeChange(option.id)
                          setModeMenuOpen(false)
                        }}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          modeDisabled && 'cursor-not-allowed opacity-50',
                          active
                            ? 'text-[var(--color-text-strong)]'
                            : 'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
                        )}
                      >
                        <span>{t(option.labelKey)}</span>
                        {active ? <Check size={13} className="text-[var(--color-accent)]" /> : null}
                      </button>
                    )
                  })}
                </Popover>
              </div>
            </PopoverAnchor>
          )}
        </div>
      </div>

      {/* Context selectors live below the panel as link-style dropdowns
          (Codex-style): the text reads as a link and opens a native select. */}
      <div className="flex flex-wrap items-center gap-4 px-2">
        {onWorkspaceBrowse || onWorkspaceOpenRecent ? (
          <WorkspaceMenuLink
            icon={<Folder size={13} aria-hidden />}
            aria-label={t('chat.workspaceAria')}
            value={workspaceValue}
            options={workspaceOptions}
            recentOptions={workspaceRecentOptions}
            disabled={disabled}
            onChange={onWorkspaceChange}
            onBrowse={onWorkspaceBrowse}
            onOpenRecent={onWorkspaceOpenRecent}
            onRemoveRecent={onWorkspaceRemoveRecent}
          />
        ) : (
          <LinkSelect
            icon={<Folder size={13} aria-hidden />}
            aria-label={t('chat.workspaceAria')}
            value={workspaceValue}
            options={resolvedWorkspaceOptions}
            disabled={disabled}
            onChange={onWorkspaceChange}
          />
        )}
        <LinkSelect
          icon={<GitBranch size={13} aria-hidden />}
          aria-label={t('chat.branchAria')}
          value={branchValue}
          options={resolvedBranchOptions}
          disabled={disabled}
          onChange={onBranchChange}
          useFilter
          filterPlaceholder={t('chat.branchFilterPlaceholder')}
          filterEmptyLabel={t('chat.branchFilterEmpty')}
        />
      </div>
    </div>
  )
}

interface WorkspaceMenuLinkProps extends LinkSelectProps {
  recentOptions: ChatSelectOption[]
  onBrowse?: () => void
  onOpenRecent?: (path: string) => Promise<void> | void
  onRemoveRecent?: (path: string) => Promise<void> | void
}

function WorkspaceMenuLink({
  icon,
  value,
  options,
  recentOptions,
  disabled,
  onChange,
  onBrowse,
  onOpenRecent,
  onRemoveRecent,
  ...rest
}: WorkspaceMenuLinkProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  const currentLabel = options.find((option) => option.value === value)?.label || value || '—'

  async function handleOpenRecent(path: string) {
    if (!onOpenRecent) {
      onChange(path)
      setOpen(false)
      return
    }
    setMenuError(null)
    try {
      await onOpenRecent(path)
      onChange(path)
      setOpen(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('common.failedToOpenWorkspace')
      setMenuError(message)
    }
  }

  async function handleRemoveRecent(path: string) {
    if (!onRemoveRecent) return
    setMenuError(null)
    try {
      await onRemoveRecent(path)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('common.failedToRemoveWorkspace')
      setMenuError(message)
    }
  }

  return (
    <PopoverAnchor>
      <span className="relative inline-flex items-center gap-1 text-[var(--color-muted-strong)]">
        <span className="pointer-events-none flex items-center">{icon}</span>
        <button
          type="button"
          aria-label={rest['aria-label']}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            setMenuError(null)
            setOpen((current) => !current)
          }}
          className="inline-flex items-center gap-0.5 rounded px-0.5 text-xs font-medium text-inherit transition-colors hover:text-[var(--color-text)] focus:text-[var(--color-text)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="max-w-[14rem] truncate">{currentLabel}</span>
          <ChevronDown size={12} aria-hidden className="text-[var(--color-muted)]" />
        </button>
      </span>
      <Popover
        open={open}
        onClose={() => {
          setOpen(false)
          setMenuError(null)
        }}
        placement="top-start"
        className="w-[26rem] p-2"
      >
        {onBrowse ? (
          <button
            type="button"
            className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
            onClick={() => {
              setOpen(false)
              setMenuError(null)
              onBrowse()
            }}
          >
            {t('common.openFolder')}
          </button>
        ) : null}
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {t('common.recentWorkspaces')}
        </p>
        {recentOptions.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-[var(--color-muted)]">
            {t('common.noRecentWorkspaces')}
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto">
            {recentOptions.map((workspace) => (
              <li key={workspace.value} className="group flex items-center gap-1 px-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
                  title={workspace.value}
                  onClick={() => void handleOpenRecent(workspace.value)}
                >
                  <span className="block truncate">{workspace.label}</span>
                </button>
                {onRemoveRecent ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] text-[var(--color-muted)] opacity-0 transition-opacity hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)] group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={t('common.removeWorkspaceAria', { path: workspace.value })}
                    onClick={() => void handleRemoveRecent(workspace.value)}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {menuError ? (
          <p className="mt-1 px-2 py-1 text-xs text-[var(--color-alert)]">{menuError}</p>
        ) : null}
      </Popover>
    </PopoverAnchor>
  )
}

interface LinkSelectProps {
  icon: React.ReactNode
  'aria-label': string
  value: string
  options: ChatSelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
  useFilter?: boolean
  filterPlaceholder?: string
  filterEmptyLabel?: string
}

/** A native select dressed as an inline link: icon + label + caret. */
function LinkSelect({
  icon,
  value,
  options,
  disabled,
  onChange,
  useFilter = false,
  filterPlaceholder,
  filterEmptyLabel,
  ...rest
}: LinkSelectProps) {
  if (useFilter) {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--color-muted-strong)]">
        <span className="pointer-events-none flex items-center">{icon}</span>
        <ModelFilterCombobox
          ariaLabel={rest['aria-label']}
          options={options}
          value={value}
          disabled={disabled}
          placeholder={value || rest['aria-label']}
          searchPlaceholder={filterPlaceholder}
          emptyLabel={filterEmptyLabel}
          className="h-7 max-w-[14rem] border-0 bg-transparent px-0 py-0 text-xs font-medium text-[var(--color-muted-strong)]!"
          onChange={onChange}
        />
      </span>
    )
  }

  return (
    <span className="relative inline-flex items-center gap-1 text-[var(--color-muted-strong)]">
      <span className="pointer-events-none flex items-center">{icon}</span>
      <span className="relative inline-flex items-center">
        <select
          aria-label={rest['aria-label']}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-medium text-inherit transition-colors hover:text-[var(--color-text)] focus:text-[var(--color-text)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          aria-hidden
          className="pointer-events-none absolute right-0 text-[var(--color-muted)]"
        />
      </span>
    </span>
  )
}
