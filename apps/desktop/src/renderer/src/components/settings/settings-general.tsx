import type { AvailableThemeId, ComposerAssistDefaultMode, UiLanguage } from '@planetz/shared'
import { ORBIT_DISPLAY_NAME } from '@planetz/shared'
import { FolderOpen } from 'lucide-react'
import { useI18n } from '../../i18n'
import { AVAILABLE_THEMES } from '../../skins/registry'
import { Field } from '../ui/input'
import { Select } from '../ui/select'
import { Toggle } from '../ui/toggle'

interface SettingsGeneralProps {
  workspacePath: string | null
  taktExecutionPath?: string | null
  watchAutoStart: boolean
  theme: AvailableThemeId
  counterPackEnabled: boolean
  language: UiLanguage
  composerAssistDefaultMode: ComposerAssistDefaultMode
  workflowLowConfidenceGateEnabled: boolean
  disabled?: boolean
  onChange: (patch: {
    watchAutoStart?: boolean
    theme?: AvailableThemeId
    counterPackEnabled?: boolean
    language?: UiLanguage
    composerAssistDefaultMode?: ComposerAssistDefaultMode
    workflowLowConfidenceGateEnabled?: boolean
  }) => void
  onSelectWorkspace: () => Promise<void> | void
}

export function SettingsGeneral({
  workspacePath,
  taktExecutionPath = null,
  watchAutoStart,
  theme,
  counterPackEnabled,
  language,
  composerAssistDefaultMode,
  workflowLowConfidenceGateEnabled,
  disabled = false,
  onChange,
  onSelectWorkspace,
}: SettingsGeneralProps) {
  const { t } = useI18n()
  const showTaktExecutionPath =
    Boolean(taktExecutionPath) && Boolean(workspacePath) && taktExecutionPath !== workspacePath

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t('settings.general.workspace.label')}
        hint={t('settings.general.workspace.hint')}
      >
        <button
          type="button"
          onClick={() => void onSelectWorkspace()}
          disabled={disabled}
          className="focus-ring group flex w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-1.5 text-left font-mono text-xs text-[var(--color-text)] hover:border-[var(--color-ring)] hover:bg-[var(--color-panel)]/60"
        >
          <FolderOpen
            size={13}
            className="shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-accent)]"
          />
          <span className="min-w-0 flex-1 truncate">
            {workspacePath || (
              <span className="text-[var(--color-muted)]">{t('common.noWorkspaceSelected')}</span>
            )}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">
            {t('common.choose')}
          </span>
        </button>
      </Field>

      <label className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={watchAutoStart}
          disabled={disabled}
          onChange={(e) => onChange({ watchAutoStart: e.target.checked })}
        />
        <span className="text-sm">
          <span className="font-medium text-[var(--color-text)]">
            {t('settings.general.watchAutoStart.labelPrefix')}
          </span>
          <span className="font-mono text-[var(--color-text)]">{ORBIT_DISPLAY_NAME} watch</span>
          <span className="block text-[11px] text-[var(--color-muted)]">
            {t('settings.general.watchAutoStart.hint')}
          </span>
        </span>
      </label>

      <Field
        label={t('settings.general.language.label')}
        hint={t('settings.general.language.hint')}
      >
        <Select
          fullWidth
          value={language}
          disabled={disabled}
          onChange={(e) => onChange({ language: e.target.value as UiLanguage })}
        >
          <option value="en">{t('settings.general.language.optionEn')}</option>
          <option value="ja">{t('settings.general.language.optionJa')}</option>
        </Select>
      </Field>

      <Field label={t('settings.general.theme.label')} hint={t('settings.general.theme.hint')}>
        <Select
          fullWidth
          value={theme}
          disabled={disabled}
          onChange={(e) => onChange({ theme: e.target.value as AvailableThemeId })}
        >
          {AVAILABLE_THEMES.map((themeOption) => (
            <option key={themeOption.id} value={themeOption.id}>
              {themeOption.displayName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('settings.general.skin.label')} hint={t('settings.general.skin.hint')}>
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-[var(--color-text)]">
              {t('settings.general.skin.mantaMode')}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              {t('settings.general.skin.mantaModeHint')}
            </p>
          </div>
          <Toggle
            checked={counterPackEnabled}
            disabled={disabled}
            onCheckedChange={(enabled) => onChange({ counterPackEnabled: enabled })}
            aria-label={t('settings.general.skin.mantaMode')}
          />
        </div>
      </Field>

      <Field
        label="Workflow routing"
        hint="When enabled, low-confidence Auto routing asks for confirmation before enqueue."
      >
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-[var(--color-text)]">Low-confidence gate</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              Prompt before enqueue when Auto confidence is low.
            </p>
          </div>
          <Toggle
            checked={workflowLowConfidenceGateEnabled}
            disabled={disabled}
            onCheckedChange={(enabled) => onChange({ workflowLowConfidenceGateEnabled: enabled })}
            aria-label="Low-confidence gate"
          />
        </div>
      </Field>

      <Field
        label={t('settings.general.composerAssistDefaultMode.label')}
        hint={t('settings.general.composerAssistDefaultMode.hint')}
      >
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-[var(--color-text)]">
              {t('settings.general.composerAssistDefaultMode.assistMode')}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              {t('settings.general.composerAssistDefaultMode.assistModeHint')}
            </p>
          </div>
          <Toggle
            checked={composerAssistDefaultMode === 'assist'}
            disabled={disabled}
            onCheckedChange={(enabled) =>
              onChange({ composerAssistDefaultMode: enabled ? 'assist' : 'direct' })
            }
            aria-label={t('settings.general.composerAssistDefaultMode.assistMode')}
          />
        </div>
      </Field>

      {showTaktExecutionPath ? (
        <Field
          label={t('settings.general.taktExecution.label')}
          hint={t('settings.general.taktExecution.hint')}
        >
          <p
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-2.5 py-2 font-mono text-xs text-[var(--color-muted-strong)] break-all"
            title={taktExecutionPath ?? undefined}
          >
            {taktExecutionPath}
          </p>
        </Field>
      ) : null}
    </div>
  )
}
