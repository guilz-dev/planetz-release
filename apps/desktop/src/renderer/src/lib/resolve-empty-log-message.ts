/** Empty-state copy when the log table has no rows and `total` is zero. */
export function resolveEmptyLogMessage(
  rawTotalInWindow: number | undefined,
  total: number,
  t: (key: 'views.log.emptyNoRuns' | 'views.log.emptyFiltered') => string,
): string {
  if (rawTotalInWindow === undefined) {
    return total === 0 ? t('views.log.emptyNoRuns') : t('views.log.emptyFiltered')
  }
  if (rawTotalInWindow === 0) return t('views.log.emptyNoRuns')
  return t('views.log.emptyFiltered')
}
