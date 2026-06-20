import type { ChainPlannedTask, TaskViewModel } from '@planetz/shared'

const CHAIN_CONTEXT_HEADER = '---\nChain context'

/** Embeds branch / upstream metadata in the task body for production enqueue paths. */
export function buildChainTaskEnqueueBody(
  planned: ChainPlannedTask,
  origin: Pick<TaskViewModel, 'id' | 'title'>,
): string | undefined {
  const sections: string[] = []
  if (planned.body?.trim()) sections.push(planned.body.trim())

  const meta: string[] = [
    `Upstream task: ${origin.id} (${origin.title})`,
    `Chain mode: ${planned.mode}`,
  ]
  if (planned.sourceBranch) meta.push(`Source branch: ${planned.sourceBranch}`)
  if (planned.baseBranch) meta.push(`Base branch: ${planned.baseBranch}`)

  sections.push(`${CHAIN_CONTEXT_HEADER}\n${meta.join('\n')}`)
  return sections.join('\n\n')
}
