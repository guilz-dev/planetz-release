const REDACTED = '[REDACTED]'

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /sk-proj-[a-zA-Z0-9_-]{20,}/g,
  /ghp_[a-zA-Z0-9]{20,}/g,
  /gho_[a-zA-Z0-9]{20,}/g,
  /ghu_[a-zA-Z0-9]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{20,}/g,
  /xox[baprs]-[0-9A-Za-z-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
]

export function redactSecrets(text: string): string {
  let out = text
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  return out
}
