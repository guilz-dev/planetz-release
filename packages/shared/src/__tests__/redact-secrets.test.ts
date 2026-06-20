import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../redact-secrets.js'

describe('redactSecrets', () => {
  it('redacts common secret patterns', () => {
    const input = 'key=sk-abcdefghijklmnopqrstuvwxyz token Bearer abc.def.ghi'
    const out = redactSecrets(input)
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwxyz')
    expect(out).toContain('[REDACTED]')
  })

  it('redacts AWS, GCP, Slack, and GitHub token prefixes', () => {
    const input = [
      'AKIAIOSFODNN7EXAMPLE',
      'AIzaSyD-0123456789012345678901234567',
      'xoxb-123-456-abc',
      'gho_abcdefghijklmnopqrstuvwxyz',
    ].join(' ')
    const out = redactSecrets(input)
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(out).not.toContain('AIzaSyD-0123456789012345678901234567')
    expect(out).not.toContain('xoxb-123-456-abc')
    expect(out).not.toContain('gho_abcdefghijklmnopqrstuvwxyz')
    expect(out.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('redacts PEM private key blocks', () => {
    const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/y
-----END RSA PRIVATE KEY-----`
    const out = redactSecrets(input)
    expect(out).not.toContain('BEGIN RSA PRIVATE KEY')
    expect(out).toContain('[REDACTED]')
  })
})
