export function diffLines(
  a: string,
  b: string,
): Array<{ kind: 'eq' | 'add' | 'del'; text: string }> {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const m = aLines.length
  const n = bLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: Array<{ kind: 'eq' | 'add' | 'del'; text: string }> = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      out.push({ kind: 'eq', text: aLines[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'del', text: aLines[i] })
      i += 1
    } else {
      out.push({ kind: 'add', text: bLines[j] })
      j += 1
    }
  }
  while (i < m) out.push({ kind: 'del', text: aLines[i++] })
  while (j < n) out.push({ kind: 'add', text: bLines[j++] })
  return out
}
