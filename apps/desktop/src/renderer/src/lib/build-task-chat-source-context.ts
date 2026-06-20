import {
  normalizeComposerAssistSourceContext,
  redactSecrets,
  type TaskViewModel,
} from '@planetz/shared'

/** Minimal untrusted source context for Task detail → Conversation Mode handoff. */
export function buildTaskChatSourceContext(task: TaskViewModel): string {
  const sections: string[] = [
    '## Task context',
    `Task ID: ${task.id}`,
    ...(task.workflow?.trim() ? [`Workflow: ${task.workflow.trim()}`] : []),
    ...(task.title?.trim() ? [`Title: ${task.title.trim()}`] : []),
    '',
    '### Instruction body',
    task.body?.trim() || '(empty)',
  ]

  if (task.failure) {
    sections.push('', '### Failure summary', `Kind: ${task.failure.kind}`)
    if (task.failure.message?.trim()) {
      sections.push(task.failure.message.trim())
    }
    if (task.failure.failedStep?.trim()) {
      sections.push(`Failed step: ${task.failure.failedStep.trim()}`)
    }
    const logs = task.failure.recentErrorLog ?? []
    if (logs.length > 0) {
      sections.push('', 'Recent errors:')
      for (const entry of logs) {
        sections.push(`- [${entry.level}] ${entry.message}`)
      }
    }
  }

  return normalizeComposerAssistSourceContext(redactSecrets(sections.join('\n')))
}
