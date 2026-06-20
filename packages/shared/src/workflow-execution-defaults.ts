import type { ExecutionProfileOverrides } from './execution-profile.js'

function trimScalar(value: string): string | undefined {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  return trimmed.length > 0 ? trimmed : undefined
}

/** Top-level keys only (no leading whitespace). */
function readTopLevelScalar(lines: string[], key: string): string | undefined {
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue
    const match = line.match(new RegExp(`^${key}:\\s*(.+)$`))
    if (match) return trimScalar(match[1])
  }
  return undefined
}

/** Keys under `workflow_config:` (indented), not step-level fields. */
function readWorkflowConfigScalar(lines: string[], key: string): string | undefined {
  let inBlock = false
  for (const line of lines) {
    if (/^workflow_config:\s*($|\{)/.test(line)) {
      inBlock = true
      continue
    }
    if (inBlock && line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      inBlock = false
    }
    if (!inBlock) continue
    const match = line.match(new RegExp(`^\\s+${key}:\\s*(.+)$`))
    if (match) return trimScalar(match[1])
  }
  return undefined
}

/** Extract default provider/model from a canonical `.planetz/orbit/workflows/*.yaml` document. */
export function extractWorkflowExecutionDefaults(yaml: string): ExecutionProfileOverrides {
  const lines = yaml.split('\n')
  const provider =
    readTopLevelScalar(lines, 'provider') ?? readWorkflowConfigScalar(lines, 'provider')
  const model = readTopLevelScalar(lines, 'model') ?? readWorkflowConfigScalar(lines, 'model')
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  }
}
