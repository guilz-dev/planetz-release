export function workflowStepIsOverridable(stepRaw: Record<string, unknown>): boolean {
  if (stepRaw.overridable === true || stepRaw.optional === true) return true
  const name = typeof stepRaw.name === 'string' ? stepRaw.name.toLowerCase() : ''
  return (
    name.includes('review') ||
    name.includes('test') ||
    name.includes('self_check') ||
    name.includes('self-check') ||
    name.includes('self')
  )
}
