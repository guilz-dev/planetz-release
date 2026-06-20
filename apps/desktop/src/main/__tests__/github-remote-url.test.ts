import { describe, expect, it } from 'vitest'
import { parseGitHubRemoteUrl } from '../lib/github-remote-url.js'

describe('parseGitHubRemoteUrl', () => {
  it('parses HTTPS and SSH GitHub remotes', () => {
    expect(parseGitHubRemoteUrl('https://github.com/guilz-dev/planetz.git')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
    })
    expect(parseGitHubRemoteUrl('git@github.com:guilz-dev/planetz.git')).toEqual({
      owner: 'guilz-dev',
      name: 'planetz',
    })
  })
})
