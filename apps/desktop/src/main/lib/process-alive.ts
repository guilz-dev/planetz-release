/** Returns whether `pid` refers to a live process (signal 0 probe). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
