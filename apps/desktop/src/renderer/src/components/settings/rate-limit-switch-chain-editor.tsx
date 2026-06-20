import type { ExecutionOverrideOptionSources, RateLimitSwitchEntry } from '@planetz/shared'
import { ExecutionProfileFields } from '../execution-profile-fields'
import { Button } from '../ui/button'

interface RateLimitSwitchChainEditorProps {
  chain: RateLimitSwitchEntry[]
  onChainChange: (next: RateLimitSwitchEntry[]) => void
  profileSources: ExecutionOverrideOptionSources
  disabled?: boolean
  reloadKey?: number | string
}

export function RateLimitSwitchChainEditor({
  chain,
  onChainChange,
  profileSources,
  disabled = false,
  reloadKey,
}: RateLimitSwitchChainEditorProps) {
  function updateEntry(index: number, patch: Partial<RateLimitSwitchEntry>) {
    const next = [...chain]
    next[index] = { ...chain[index]!, ...patch }
    onChainChange(next)
  }

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        rate_limit_fallback.switch_chain
      </h3>
      <ul className="flex flex-col gap-2">
        {chain.map((entry, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: list is edited by index only
            key={index}
            className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--color-border)] p-2"
          >
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <ExecutionProfileFields
                providerId={`fallback-provider-${index}`}
                modelId={`fallback-model-${index}`}
                value={{
                  provider: entry.provider ?? '',
                  model: entry.model ?? '',
                }}
                sources={{
                  ...profileSources,
                  currentProvider: entry.provider,
                  currentModel: entry.model,
                }}
                reloadKey={reloadKey}
                disabled={disabled}
                onChange={({ provider, model }) =>
                  updateEntry(index, {
                    provider: provider || undefined,
                    model: model || undefined,
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChainChange(chain.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        className="mt-2"
        onClick={() => onChainChange([...chain, {}])}
      >
        Add fallback step
      </Button>
    </section>
  )
}
