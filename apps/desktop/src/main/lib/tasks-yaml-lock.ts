const queues = new Map<string, Promise<void>>()

/** Serialize tasks.yaml read/write per file path (§11 exclusive section). */
export async function withTasksYamlLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const tail = queues.get(lockKey) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const next = tail.then(() => gate)
  queues.set(lockKey, next)
  await tail
  try {
    return await fn()
  } finally {
    release()
    if (queues.get(lockKey) === next) {
      queues.delete(lockKey)
    }
  }
}
