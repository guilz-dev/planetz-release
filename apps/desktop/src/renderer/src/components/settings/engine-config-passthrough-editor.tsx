import {
  type EngineConfig,
  mergeEngineConfigPassthrough,
  parseYamlMapping,
  passthroughFromEngineConfig,
  valueToYamlText,
} from '@planetz/shared'
import { useState } from 'react'
import { Field, Textarea } from '../ui/input'

interface EngineConfigPassthroughEditorProps {
  config: EngineConfig
  onConfigChange: (next: EngineConfig) => void
}

export function EngineConfigPassthroughEditor({
  config,
  onConfigChange,
}: EngineConfigPassthroughEditorProps) {
  const [text, setText] = useState(() => valueToYamlText(passthroughFromEngineConfig(config)))
  const [parseError, setParseError] = useState<string | null>(null)

  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
        Additional config keys
      </h3>
      <Field
        label="Passthrough YAML"
        hint="Any keys not covered by the form above (e.g. task_poll_interval_ms, notification_sound). Leave empty to omit."
      >
        <Textarea
          value={text}
          rows={6}
          className="font-mono text-[11px]"
          placeholder="# notification_sound: true"
          onChange={(e) => {
            const nextText = e.target.value
            setText(nextText)
            try {
              onConfigChange(mergeEngineConfigPassthrough(config, parseYamlMapping(nextText)))
              setParseError(null)
            } catch (err) {
              setParseError(err instanceof Error ? err.message : String(err))
            }
          }}
        />
      </Field>
      {parseError ? (
        <p className="mt-1 text-[11px] text-[var(--color-status-failed)]">{parseError}</p>
      ) : null}
    </section>
  )
}
