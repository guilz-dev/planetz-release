import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatGateway, ChatSelectOption } from '../components/chat/chat-types'
import type { ComposerSummaryPreviewData } from '../components/composer-summary-preview'

function workspaceLabelFromPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function ensureSelectedOption(
  options: ChatSelectOption[],
  value: string,
  labelResolver?: (value: string) => string,
): ChatSelectOption[] {
  const trimmed = value.trim()
  if (!trimmed) return options
  if (options.some((option) => option.value === trimmed)) return options
  return [
    ...options,
    {
      value: trimmed,
      label: labelResolver ? labelResolver(trimmed) : trimmed,
    },
  ]
}

function normalizeAllowedProviders(allowedProviders?: ReadonlyArray<string>): string {
  if (!allowedProviders || allowedProviders.length === 0) return ''
  const normalized = Array.from(
    new Set(allowedProviders.map((id) => id.trim()).filter((id) => id.length > 0)),
  ).sort()
  return normalized.join('\n')
}

export type UseChatComposerStateOptions = {
  gateway: ChatGateway
  currentWorkspacePath?: string
  allowedProviders?: ReadonlyArray<string>
}

export function useChatComposerState({
  gateway,
  currentWorkspacePath,
  allowedProviders,
}: UseChatComposerStateOptions) {
  const allowedProvidersSignature = normalizeAllowedProviders(allowedProviders)
  const initialWorkspacePath = currentWorkspacePath?.trim() ?? ''
  const [draft, setDraft] = useState('')
  const [specPreview, setSpecPreview] = useState<ComposerSummaryPreviewData | null>(null)
  const [workspaceOptions, setWorkspaceOptions] = useState<ChatSelectOption[]>(
    initialWorkspacePath
      ? [{ value: initialWorkspacePath, label: workspaceLabelFromPath(initialWorkspacePath) }]
      : [],
  )
  const [branchOptions, setBranchOptions] = useState<ChatSelectOption[]>([])
  const [providerOptions, setProviderOptions] = useState<ChatSelectOption[]>([])
  const [allModelOptions, setAllModelOptions] = useState<ChatSelectOption[]>([])
  const [modelOptions, setModelOptions] = useState<ChatSelectOption[]>([])
  const [allEffortOptions, setAllEffortOptions] = useState<ChatSelectOption[]>([])
  const [effortOptions, setEffortOptions] = useState<ChatSelectOption[]>([])
  const [workspaceValue, setWorkspaceValue] = useState(initialWorkspacePath)
  const [branchValue, setBranchValue] = useState('')
  const [providerValue, setProviderValueState] = useState('')
  const [modelValue, setModelValueState] = useState('')
  const [effortValue, setEffortValueState] = useState('')
  const [modelOptionsByProvider, setModelOptionsByProvider] = useState<
    Record<string, ChatSelectOption[]>
  >({})
  const [lastSelectedModelByProvider, setLastSelectedModelByProvider] = useState<
    Record<string, string>
  >({})
  const [effortOptionsByProvider, setEffortOptionsByProvider] = useState<
    Record<string, ChatSelectOption[]>
  >({})
  const [defaultProvider, setDefaultProvider] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [defaultEffort, setDefaultEffort] = useState('')

  /**
   * Set after the user changes provider. While true, the provider-scoped effect must not
   * auto-select the first/default model. Provider switches may only restore the
   * remembered model for that provider, otherwise they stay blank.
   */
  const skipModelAutoPickRef = useRef(false)

  const setProviderValue = useCallback(
    (next: string | ((prev: string) => string)) => {
      const resolved = typeof next === 'function' ? next(providerValue) : next
      if (providerValue.trim() !== resolved.trim()) {
        skipModelAutoPickRef.current = true
        // Clear model/effort on provider change: models are provider-scoped; never carry over.
        setModelValueState('')
        setEffortValueState('')
      }
      setProviderValueState(resolved)
    },
    [providerValue],
  )

  const setModelValue = useCallback((next: string | ((prev: string) => string)) => {
    skipModelAutoPickRef.current = false
    setModelValueState(next)
  }, [])

  const canStartThread = workspaceValue.trim().length > 0 && branchValue.trim().length > 0

  useEffect(() => {
    const nextPath = currentWorkspacePath?.trim() ?? ''
    if (!nextPath) return
    setWorkspaceOptions((current) =>
      ensureSelectedOption(current, nextPath, workspaceLabelFromPath),
    )
    setWorkspaceValue((current) => (current.trim().length > 0 ? current : nextPath))
  }, [currentWorkspacePath])

  useEffect(() => {
    let cancelled = false
    void gateway.getFormOptions().then((options) => {
      if (cancelled) return
      const allowed = new Set(
        allowedProvidersSignature
          ? allowedProvidersSignature.split('\n').filter((id) => id.length > 0)
          : [],
      )
      const filteredProviders =
        allowed.size > 0
          ? options.providers.filter((option) => allowed.has(option.value.trim()))
          : options.providers
      const resolvedProviders = filteredProviders.length > 0 ? filteredProviders : options.providers
      const providerDefault =
        options.defaultProvider?.trim() &&
        resolvedProviders.some((option) => option.value === options.defaultProvider)
          ? options.defaultProvider.trim()
          : (resolvedProviders[0]?.value ?? '')
      setWorkspaceOptions((current) => {
        const merged =
          options.workspaces.length > 0
            ? options.workspaces
            : ensureSelectedOption(
                current,
                currentWorkspacePath?.trim() ?? '',
                workspaceLabelFromPath,
              )
        return merged
      })
      setBranchOptions(options.branches)
      setProviderOptions(resolvedProviders)
      setAllModelOptions(options.models)
      setModelOptions(options.models)
      setAllEffortOptions(options.efforts ?? [])
      setEffortOptions(options.efforts ?? [])
      setModelOptionsByProvider(options.modelsByProvider ?? {})
      setLastSelectedModelByProvider(options.lastSelectedModelByProvider ?? {})
      setEffortOptionsByProvider(options.effortsByProvider ?? {})
      setDefaultProvider(providerDefault)
      setDefaultModel(options.defaultModel?.trim() ?? '')
      setDefaultEffort(options.defaultEffort?.trim() ?? '')
      setWorkspaceValue(
        options.workspaces.find((o) => o.value === currentWorkspacePath)?.value ??
          options.workspaces[0]?.value ??
          currentWorkspacePath?.trim() ??
          '',
      )
      const defaultBranch =
        options.defaultBranch?.trim() &&
        options.branches.some((option) => option.value === options.defaultBranch)
          ? options.defaultBranch.trim()
          : (options.branches[0]?.value ?? '')
      setBranchValue(defaultBranch)
      setProviderValueState((currentProvider) => {
        const current = currentProvider.trim()
        if (current) return current
        return providerDefault
      })
    })
    return () => {
      cancelled = true
    }
  }, [gateway, currentWorkspacePath, allowedProvidersSignature])

  useEffect(() => {
    const providerId = providerValue.trim()
    const scopedModels = providerId ? modelOptionsByProvider[providerId] : undefined
    const baseModelOptions =
      scopedModels && scopedModels.length > 0
        ? scopedModels
        : providerId.length > 0 && providerId === defaultProvider
          ? allModelOptions
          : []
    // Only inject the current value into the list when it belongs to this provider.
    // Do not call ensureSelectedOption for a stale cross-provider model (regression guard).
    const nextModelOptions =
      modelValue.trim() && baseModelOptions.some((option) => option.value === modelValue.trim())
        ? ensureSelectedOption(baseModelOptions, modelValue)
        : baseModelOptions
    const scopedEfforts = providerId ? effortOptionsByProvider[providerId] : undefined
    const baseEffortOptions =
      scopedEfforts && scopedEfforts.length > 0
        ? scopedEfforts
        : providerId.length > 0 && providerId === defaultProvider
          ? allEffortOptions
          : []
    const nextEffortOptions = ensureSelectedOption(baseEffortOptions, effortValue)
    setModelOptions(nextModelOptions)
    setEffortOptions(nextEffortOptions)
    setModelValueState((currentModel) => {
      const current = currentModel.trim()
      if (current && nextModelOptions.some((option) => option.value === current)) {
        return current
      }
      const rememberedModel = lastSelectedModelByProvider[providerId]?.trim() ?? ''
      // Provider switch cleared the model: restore the provider-scoped remembered model only.
      if (skipModelAutoPickRef.current && !current) {
        return rememberedModel &&
          nextModelOptions.some((option) => option.value === rememberedModel)
          ? rememberedModel
          : ''
      }
      const useDefault =
        providerId.length > 0 &&
        providerId === defaultProvider &&
        defaultModel.length > 0 &&
        nextModelOptions.some((option) => option.value === defaultModel)
      if (useDefault) return defaultModel
      return nextModelOptions[0]?.value ?? ''
    })
    setEffortValueState((currentEffort) => {
      const current = currentEffort.trim()
      if (current && nextEffortOptions.some((option) => option.value === current)) {
        return current
      }
      const useDefault =
        providerId.length > 0 &&
        providerId === defaultProvider &&
        defaultEffort.length > 0 &&
        nextEffortOptions.some((option) => option.value === defaultEffort)
      if (useDefault) return defaultEffort
      return ''
    })
  }, [
    providerValue,
    modelValue,
    effortValue,
    modelOptionsByProvider,
    allModelOptions,
    effortOptionsByProvider,
    allEffortOptions,
    lastSelectedModelByProvider,
    defaultProvider,
    defaultModel,
    defaultEffort,
  ])

  const dismissSpecPreview = useCallback(() => {
    setSpecPreview(null)
  }, [])

  return {
    draft,
    setDraft,
    specPreview,
    setSpecPreview,
    dismissSpecPreview,
    workspaceOptions,
    branchOptions,
    modelOptions,
    workspaceValue,
    setWorkspaceValue,
    branchValue,
    setBranchValue,
    providerOptions,
    providerValue,
    setProviderValue,
    modelValue,
    setModelValue,
    effortOptions,
    effortValue,
    setEffortValue: setEffortValueState,
    canStartThread,
  }
}
