import {
  collectModelOptions,
  collectProviderOptions,
  effortHintsForOrbitProvider,
  isOrbitProviderId,
  orbitProviderDisplayLabel,
  readEffortFromProviderOptions,
} from '@planetz/shared'
import type { ChatSelectOption } from '../components/chat/chat-types'
import {
  CHAT_FORM_FALLBACK_BRANCH_OPTIONS,
  CHAT_FORM_FALLBACK_MODEL_OPTIONS,
  CHAT_FORM_FALLBACK_PROVIDER_OPTIONS,
} from './chat-form-option-fallbacks.js'
import { formatModelOptionLabel } from './model-option-label.js'

const CHAT_FORM_PROVIDER_LIVE_FETCH_TIMEOUT_MS = 6_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function toSelectOptions(ids: string[], formatLabel?: (id: string) => string): ChatSelectOption[] {
  return ids.map((id) => ({ value: id, label: formatLabel ? formatLabel(id) : id }))
}

function providerLabel(providerId: string): string {
  if (isOrbitProviderId(providerId)) return orbitProviderDisplayLabel(providerId)
  return providerId
}

function toModelOptions(
  models: Array<{ id: string; label?: string }> | readonly string[],
): ChatSelectOption[] {
  return models.map((model) => {
    if (typeof model === 'string') return { value: model, label: model }
    return {
      value: model.id,
      label: formatModelOptionLabel(model.id, model.label),
    }
  })
}

export type ChatFormOptionsResult = {
  branches: ChatSelectOption[]
  providers: ChatSelectOption[]
  models: ChatSelectOption[]
  modelsByProvider: Record<string, ChatSelectOption[]>
  lastSelectedModelByProvider: Record<string, string>
  efforts: ChatSelectOption[]
  effortsByProvider: Record<string, ChatSelectOption[]>
  defaultBranch: string
  defaultProvider: string
  defaultModel: string
  defaultEffort: string
}

/** Loads engine/catalog-backed provider+model options and local git branches for chat composer. */
export async function fetchChatFormOptions(options?: {
  providerLiveFetchTimeoutMs?: number
}): Promise<ChatFormOptionsResult> {
  const providerLiveFetchTimeoutMs =
    options?.providerLiveFetchTimeoutMs ?? CHAT_FORM_PROVIDER_LIVE_FETCH_TIMEOUT_MS

  const [engineResult, catalogResult, branchListResult, currentBranchResult] =
    await Promise.allSettled([
      window.orbit.getEngineConfig(),
      window.orbit.listExecutionCatalog(),
      window.orbit.listWorkspaceGitBranches(),
      window.orbit.getWorkspaceCurrentGitBranch(),
    ])

  const engineConfig = engineResult.status === 'fulfilled' ? engineResult.value.config : null
  const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null
  const branchList =
    branchListResult.status === 'fulfilled'
      ? branchListResult.value.branches
          .map((branch) => branch.trim())
          .filter((branch) => branch.length > 0)
      : []
  const resolvedCurrentBranch =
    branchListResult.status === 'fulfilled' && branchListResult.value.currentBranch
      ? branchListResult.value.currentBranch.trim()
      : currentBranchResult.status === 'fulfilled' && currentBranchResult.value.branch
        ? currentBranchResult.value.branch.trim()
        : null

  const configuredProvider = engineConfig?.provider?.trim()
  const providerIds = collectProviderOptions({
    engineConfig,
    catalog,
    currentProvider: configuredProvider,
    currentModel: engineConfig?.model,
  })
  const providers =
    providerIds.length > 0
      ? toSelectOptions(providerIds, providerLabel)
      : [...CHAT_FORM_FALLBACK_PROVIDER_OPTIONS]
  const defaultProvider =
    configuredProvider && providers.some((option) => option.value === configuredProvider)
      ? configuredProvider
      : (providers[0]?.value ?? '')

  const modelsByProviderEntriesPromise = Promise.all(
    providers.map(async (providerOption) => {
      const providerId = providerOption.value
      let lastSelectedModel: string | undefined
      try {
        const live = await withTimeout(
          window.orbit.listProviderModels({
            provider: providerId,
            ...(providerId === configuredProvider && engineConfig?.model?.trim()
              ? { currentModel: engineConfig.model.trim() }
              : {}),
          }),
          providerLiveFetchTimeoutMs,
        )
        lastSelectedModel = live.lastSelectedModel?.trim() || undefined
        if (live.models.length > 0) {
          return {
            providerId,
            models: toModelOptions(live.models),
            lastSelectedModel,
          } as const
        }
      } catch {
        // Non-fatal: fall back to catalog/config based candidates.
      }
      const modelIds = collectModelOptions({
        engineConfig,
        catalog,
        currentProvider: providerId,
        currentModel: providerId === configuredProvider ? engineConfig?.model : undefined,
      })
      const mergedModelIds =
        lastSelectedModel && !modelIds.includes(lastSelectedModel)
          ? [...modelIds, lastSelectedModel]
          : modelIds
      return {
        providerId,
        models: toModelOptions(mergedModelIds),
        lastSelectedModel,
      } as const
    }),
  )

  const configuredProviderOptions =
    engineConfig && typeof engineConfig === 'object'
      ? (engineConfig as Record<string, unknown>).provider_options
      : undefined
  const effortByProviderEntriesPromise = Promise.all(
    providers.map(async (providerOption) => {
      const providerId = providerOption.value
      const configuredEffort = readEffortFromProviderOptions(providerId, configuredProviderOptions)
      try {
        const live = await withTimeout(
          window.orbit.listProviderEfforts({
            provider: providerId,
            ...(configuredEffort ? { currentEffort: configuredEffort } : {}),
          }),
          providerLiveFetchTimeoutMs,
        )
        if (live.efforts.length > 0) {
          return [providerId, toSelectOptions(live.efforts.map((effort) => effort.id))] as const
        }
      } catch {
        // Non-fatal: fall back to static provider hints.
      }
      const fallbackEfforts = [...effortHintsForOrbitProvider(providerId)]
      if (configuredEffort && !fallbackEfforts.includes(configuredEffort)) {
        fallbackEfforts.push(configuredEffort)
      }
      return [providerId, toSelectOptions(fallbackEfforts)] as const
    }),
  )

  const [modelsByProviderEntries, effortByProviderEntries] = await Promise.all([
    modelsByProviderEntriesPromise,
    effortByProviderEntriesPromise,
  ])

  const modelsByProvider = Object.fromEntries(
    modelsByProviderEntries.map((entry) => [entry.providerId, entry.models]),
  )
  const lastSelectedModelByProvider = Object.fromEntries(
    modelsByProviderEntries.flatMap((entry) =>
      entry.lastSelectedModel ? [[entry.providerId, entry.lastSelectedModel] as const] : [],
    ),
  )
  const effortsByProvider = Object.fromEntries(effortByProviderEntries)
  const models = (defaultProvider && modelsByProvider[defaultProvider]?.length
    ? modelsByProvider[defaultProvider]
    : undefined) ?? [...CHAT_FORM_FALLBACK_MODEL_OPTIONS]
  const efforts = defaultProvider ? (effortsByProvider[defaultProvider] ?? []) : []
  const configuredModel = engineConfig?.model?.trim()
  const defaultModel =
    configuredModel && models.some((option) => option.value === configuredModel)
      ? configuredModel
      : (models[0]?.value ?? '')
  const configuredEffort = readEffortFromProviderOptions(defaultProvider, configuredProviderOptions)
  const defaultEffort =
    configuredEffort && efforts.some((option) => option.value === configuredEffort)
      ? configuredEffort
      : ''

  const branchIds = resolvedCurrentBranch
    ? [resolvedCurrentBranch, ...branchList.filter((branch) => branch !== resolvedCurrentBranch)]
    : branchList
  const branches =
    branchIds.length > 0 ? toSelectOptions(branchIds) : [...CHAT_FORM_FALLBACK_BRANCH_OPTIONS]
  const defaultBranch =
    resolvedCurrentBranch && branches.some((option) => option.value === resolvedCurrentBranch)
      ? resolvedCurrentBranch
      : (branches[0]?.value ?? '')

  return {
    branches,
    providers,
    models,
    modelsByProvider,
    lastSelectedModelByProvider,
    efforts,
    effortsByProvider,
    defaultBranch,
    defaultProvider,
    defaultModel,
    defaultEffort,
  }
}
