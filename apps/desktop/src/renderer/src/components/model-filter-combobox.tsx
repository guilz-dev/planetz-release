import type { ProviderModelCandidate } from '@planetz/shared'
import { useI18n } from '../i18n'
import { formatModelOptionLabel } from '../lib/model-option-label.js'
import { FilterCombobox, type FilterComboboxOption } from './ui/filter-combobox'

export function providerModelCandidateLabel(candidate: ProviderModelCandidate): string {
  return formatModelOptionLabel(candidate.id, candidate.label)
}

export function buildModelFilterOptions(input: {
  candidates: readonly ProviderModelCandidate[]
  emptyOptionLabel?: string
  savedValue?: string
  savedLabelSuffix?: string
}): FilterComboboxOption[] {
  const { candidates, emptyOptionLabel, savedValue, savedLabelSuffix = ' (saved)' } = input
  const base = candidates.map((candidate) => ({
    value: candidate.id,
    label: providerModelCandidateLabel(candidate),
  }))
  const trimmedSaved = savedValue?.trim() ?? ''
  const withEmpty = emptyOptionLabel ? [{ value: '', label: emptyOptionLabel }, ...base] : base
  if (trimmedSaved && !base.some((option) => option.value === trimmedSaved)) {
    return [...withEmpty, { value: trimmedSaved, label: `${trimmedSaved}${savedLabelSuffix}` }]
  }
  return withEmpty
}

export interface ModelFilterComboboxProps {
  options: FilterComboboxOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
}

/**
 * Filterable model picker shared by chat composer and execution profile fields.
 * Wraps {@link FilterCombobox} with product i18n defaults.
 */
export function ModelFilterCombobox({
  options,
  value,
  onChange,
  disabled,
  className,
  id,
  ariaLabel,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: ModelFilterComboboxProps) {
  const { t } = useI18n()

  return (
    <FilterCombobox
      id={id}
      options={options}
      value={value}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel ?? t('modelPicker.ariaLabel')}
      placeholder={placeholder ?? t('modelPicker.placeholder')}
      searchPlaceholder={searchPlaceholder ?? t('modelPicker.filterPlaceholder')}
      emptyLabel={emptyLabel ?? t('modelPicker.filterEmpty')}
      onChange={onChange}
    />
  )
}
