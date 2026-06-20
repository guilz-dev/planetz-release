export const OPTIMISTIC_COMPOSER_TASK_ID_PREFIX = 'optimistic-composer-'

export function createOptimisticComposerTaskId(): string {
  return `${OPTIMISTIC_COMPOSER_TASK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isOptimisticComposerTaskId(taskId: string): boolean {
  return taskId.startsWith(OPTIMISTIC_COMPOSER_TASK_ID_PREFIX)
}
