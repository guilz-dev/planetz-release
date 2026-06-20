import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteWorkflowDraft,
  loadWorkflowDraft,
  saveWorkflowDraft,
} from '../lib/workflow-draft-store.js'

describe('workflow-draft-store', () => {
  const workspace = join(tmpdir(), `planetz-draft-ws-${Date.now()}`)
  let draftRoot = ''

  beforeEach(() => {
    draftRoot = join(tmpdir(), `planetz-drafts-${Date.now()}`)
    process.env.PLANETZ_DRAFT_ROOT = draftRoot
  })

  afterEach(async () => {
    delete process.env.PLANETZ_DRAFT_ROOT
    await rm(draftRoot, { recursive: true, force: true }).catch(() => undefined)
  })

  it('saves and loads draft under planetz-drafts cache', async () => {
    await mkdir(workspace, { recursive: true })
    await saveWorkflowDraft(workspace, 'default', 'name: default\nsteps: []\n')
    const loaded = await loadWorkflowDraft(workspace, 'default')
    expect(loaded).toContain('name: default')
    await deleteWorkflowDraft(workspace, 'default')
    expect(await loadWorkflowDraft(workspace, 'default')).toBeNull()
  })
})
