/** Set `key` when `hasValue`; otherwise remove a stale key from a YAML-bound record. */
export function setOrDeleteConfigField(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  hasValue: boolean,
): void {
  if (hasValue) {
    target[key] = value
  } else {
    delete target[key]
  }
}
