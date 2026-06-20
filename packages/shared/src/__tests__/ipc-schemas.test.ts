import { describe, expect, it } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { IPC_CHANNELS } from '../ipc-channels.js'
import {
  agentOverridesUpdateInputSchema,
  canonicalImportConfirmInputSchema,
  composerSessionAcceptInputSchema,
  composerSessionCancelInputSchema,
  composerSessionFinalizeInputSchema,
  composerSessionInterruptInputSchema,
  composerSessionMessageInputSchema,
  composerSessionPlayInputSchema,
  composerSessionStartInputSchema,
  composerSourceContextBuildInputSchema,
  composerSourceContextBuildResultSchema,
  conversationHistoryDeleteInputSchema,
  conversationHistoryDeleteResultSchema,
  conversationHistoryGetInputSchema,
  conversationHistoryGetResultSchema,
  conversationHistoryListInputSchema,
  conversationHistoryListResultSchema,
  conversationHistorySearchInputSchema,
  conversationHistorySearchResultSchema,
  createResultPrInputSchema,
  desktopCapabilitiesResultSchema,
  engineConfigImportInputSchema,
  engineConfigUpdateInputSchema,
  enqueueTaskBridgeInputSchema,
  enqueueTaskInputSchema,
  executionLogListInputSchema,
  facetDeleteProjectInputSchema,
  facetReadInputSchema,
  facetWriteProjectInputSchema,
  githubIssueFetchInputSchema,
  githubIssueListOpenInputSchema,
  parseIpcInput,
  rememberProviderModelSelectionInputSchema,
  resultCheckBranchInputSchema,
  taktGlobalImportFromHomeInputSchema,
  workflowImportFromTaktInputSchema,
  yamlOpenInputSchema,
} from '../ipc-schemas.js'

describe('parseIpcInput', () => {
  it('accepts valid enqueue input', () => {
    const parsed = parseIpcInput(
      enqueueTaskInputSchema,
      {
        title: 'Fix auth',
        body: 'details',
        workflow: 'default',
        issueRef: 'guilz-dev/planetz#368',
        issueNumber: 368,
      },
      'task:enqueue',
    )
    expect(parsed.title).toBe('Fix auth')
    expect(parsed.issueRef).toBe('guilz-dev/planetz#368')
    expect(parsed.issueNumber).toBe(368)
  })

  it('rejects empty title', () => {
    expect(() => parseIpcInput(enqueueTaskInputSchema, { title: '' }, 'task:enqueue')).toThrow(
      /task:enqueue/,
    )
  })

  it('accepts bridge input without title', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      { body: 'Implement hidden title', workflow: 'default' },
      'task:enqueue',
    )
    expect(parsed.title).toBeUndefined()
  })

  it('defaults workflowMode to manual', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      { body: 'Work', workflow: 'default' },
      'task:enqueue',
    )
    expect(parsed.workflowMode).toBe('manual')
  })

  it('accepts auto mode without workflow', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      { body: 'Fix login bug', workflowMode: 'auto' },
      'task:enqueue',
    )
    expect(parsed.workflowMode).toBe('auto')
    expect(parsed.workflow).toBeUndefined()
  })

  it('rejects manual mode without workflow', () => {
    expect(() =>
      parseIpcInput(
        enqueueTaskBridgeInputSchema,
        { body: 'Work', workflowMode: 'manual' },
        'task:enqueue',
      ),
    ).toThrow(/workflow/)
  })

  it('rejects empty workflow when provided', () => {
    expect(() =>
      parseIpcInput(
        enqueueTaskBridgeInputSchema,
        { body: 'Implement hidden title', workflow: '' },
        'task:runNow',
      ),
    ).toThrow(/task:runNow/)
  })

  it('rejects whitespace-only workflow after trim', () => {
    expect(() =>
      parseIpcInput(
        enqueueTaskBridgeInputSchema,
        { body: 'Implement hidden title', workflow: '  \t  ' },
        'task:runNow',
      ),
    ).toThrow(/task:runNow/)
  })

  it('trims workflow on bridge input', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      { body: 'Do work', workflow: '  default  ' },
      'task:runNow',
    )
    expect(parsed.workflow).toBe('default')
  })

  it('accepts optional provider and model on bridge input', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      {
        body: 'Do work',
        workflow: 'default',
        provider: 'claude-sdk',
        model: 'claude-sonnet-4',
      },
      'task:runNow',
    )
    expect(parsed.provider).toBe('claude-sdk')
    expect(parsed.model).toBe('claude-sonnet-4')
  })

  it('rejects empty provider string when provided', () => {
    expect(() =>
      parseIpcInput(
        enqueueTaskBridgeInputSchema,
        { body: 'Do work', workflow: 'default', provider: '' },
        'task:runNow',
      ),
    ).toThrow(/task:runNow/)
  })

  it('rejects whitespace-only provider after trim', () => {
    expect(() =>
      parseIpcInput(
        enqueueTaskBridgeInputSchema,
        { body: 'Do work', workflow: 'default', provider: '   \t  ' },
        'task:runNow',
      ),
    ).toThrow(/task:runNow/)
  })

  it('trims provider and model', () => {
    const parsed = parseIpcInput(
      enqueueTaskBridgeInputSchema,
      {
        body: 'Do work',
        workflow: 'default',
        provider: '  claude-sdk  ',
        model: '  claude-sonnet-4  ',
      },
      'task:runNow',
    )
    expect(parsed.provider).toBe('claude-sdk')
    expect(parsed.model).toBe('claude-sonnet-4')
  })

  it('accepts stopped as execution log task-status filter', () => {
    const parsed = parseIpcInput(
      executionLogListInputSchema,
      { taskStatus: 'stopped' },
      'executionLog:list',
    )
    expect(parsed?.taskStatus).toBe('stopped')
  })
})

describe('composer session IPC schemas', () => {
  it('accepts planning-only composer session start', () => {
    const parsed = parseIpcInput(
      composerSessionStartInputSchema,
      { mode: 'planning-only', seedBody: 'Fix auth', workflow: 'default' },
      IPC_CHANNELS.composerSessionStart,
    )
    expect(parsed.mode).toBe('planning-only')
    expect(parsed.seedBody).toBe('Fix auth')
  })

  it('accepts interactive-assistant composer session start', () => {
    const parsed = parseIpcInput(
      composerSessionStartInputSchema,
      { mode: 'interactive-assistant', workflow: 'default' },
      IPC_CHANNELS.composerSessionStart,
    )
    expect(parsed.mode).toBe('interactive-assistant')
  })

  it('accepts composer session start with sourceContext', () => {
    const parsed = parseIpcInput(
      composerSessionStartInputSchema,
      {
        mode: 'interactive-assistant',
        sourceContext: '## Issue #1: Example',
      },
      IPC_CHANNELS.composerSessionStart,
    )
    expect(parsed.sourceContext).toBe('## Issue #1: Example')
  })

  it('accepts composer session start with effort', () => {
    const parsed = parseIpcInput(
      composerSessionStartInputSchema,
      {
        mode: 'interactive-assistant',
        effort: ' high ',
      },
      IPC_CHANNELS.composerSessionStart,
    )
    expect(parsed.effort).toBe('high')
  })

  it('accepts composer session start with sessionPolicy and conversationLedger', () => {
    const parsed = parseIpcInput(
      composerSessionStartInputSchema,
      {
        mode: 'interactive-assistant',
        sessionPolicy: 'planetz-chat-investigate',
        conversationLedger: {
          workspacePath: '/tmp/ws',
          branch: 'main',
          title: 'Chat thread',
        },
      },
      IPC_CHANNELS.composerSessionStart,
    )
    expect(parsed.sessionPolicy).toBe('planetz-chat-investigate')
    expect(parsed.conversationLedger).toEqual({
      workspacePath: '/tmp/ws',
      branch: 'main',
      title: 'Chat thread',
    })
  })

  it('rejects composer session start with invalid sessionPolicy', () => {
    expect(() =>
      parseIpcInput(
        composerSessionStartInputSchema,
        {
          mode: 'interactive-assistant',
          sessionPolicy: 'not-a-policy',
        },
        IPC_CHANNELS.composerSessionStart,
      ),
    ).toThrow()
  })

  it('rejects composer session start with unknown mode', () => {
    expect(() =>
      parseIpcInput(
        composerSessionStartInputSchema,
        { mode: 'execute' },
        IPC_CHANNELS.composerSessionStart,
      ),
    ).toThrow()
  })

  it('rejects empty composer session message', () => {
    expect(() =>
      parseIpcInput(
        composerSessionMessageInputSchema,
        { sessionId: 'composer_1', message: '   ' },
        IPC_CHANNELS.composerSessionMessage,
      ),
    ).toThrow()
  })

  it('accepts composer message with optional attachments', () => {
    const parsed = parseIpcInput(
      composerSessionMessageInputSchema,
      {
        sessionId: 'composer_1',
        message: 'See attached log',
        attachments: [{ kind: 'log', ref: 'build.log', priority: 'high' }],
      },
      IPC_CHANNELS.composerSessionMessage,
    )
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments?.[0]?.kind).toBe('log')
  })

  it('accepts composer finalize and cancel payloads', () => {
    const finalize = parseIpcInput(
      composerSessionFinalizeInputSchema,
      { sessionId: 'composer_1' },
      IPC_CHANNELS.composerSessionFinalize,
    )
    expect(finalize.sessionId).toBe('composer_1')

    const cancel = parseIpcInput(
      composerSessionCancelInputSchema,
      { sessionId: 'composer_1' },
      IPC_CHANNELS.composerSessionCancel,
    )
    expect(cancel.sessionId).toBe('composer_1')

    const interrupt = parseIpcInput(
      composerSessionInterruptInputSchema,
      { sessionId: 'composer_1' },
      IPC_CHANNELS.composerSessionInterrupt,
    )
    expect(interrupt.sessionId).toBe('composer_1')
  })

  it('accepts composer accept and play payloads', () => {
    const accept = parseIpcInput(
      composerSessionAcceptInputSchema,
      { sessionId: 'composer_1' },
      IPC_CHANNELS.composerSessionAccept,
    )
    expect(accept.sessionId).toBe('composer_1')

    const play = parseIpcInput(
      composerSessionPlayInputSchema,
      { sessionId: 'composer_1', task: 'Run tests' },
      IPC_CHANNELS.composerSessionPlay,
    )
    expect(play.task).toBe('Run tests')
  })

  it('rejects empty composer session play task', () => {
    expect(() =>
      parseIpcInput(
        composerSessionPlayInputSchema,
        { sessionId: 'composer_1', task: '   ' },
        IPC_CHANNELS.composerSessionPlay,
      ),
    ).toThrow()
  })

  it('accepts composer source context build inputs', () => {
    const issue = parseIpcInput(
      composerSourceContextBuildInputSchema,
      { kind: 'issue', ref: 'acme/app#1' },
      IPC_CHANNELS.composerSessionBuildSourceContext,
    )
    expect(issue.kind).toBe('issue')

    const pr = parseIpcInput(
      composerSourceContextBuildInputSchema,
      {
        kind: 'pr',
        repository: { owner: 'acme', name: 'app' },
        number: 2,
        title: 'Fix',
        url: 'https://github.com/acme/app/pull/2',
      },
      IPC_CHANNELS.composerSessionBuildSourceContext,
    )
    expect(pr.kind).toBe('pr')

    const built = composerSourceContextBuildResultSchema.parse({
      sourceContext: '## Issue #1',
    })
    expect(built.sourceContext).toBe('## Issue #1')
  })
})

describe('conversation history IPC schemas', () => {
  it('accepts desktop capabilities output', () => {
    const parsed = desktopCapabilitiesResultSchema.parse({ conversationModeEnabled: true })
    expect(parsed.conversationModeEnabled).toBe(true)
    expect(parsed.chatGateway).toBe('auto')
    expect(parsed.devProvidersAvailable).toBe(false)
    expect(parsed.chatAgentEnabled).toBe(true)
  })

  it('accepts chat agent capability fields', () => {
    const parsed = desktopCapabilitiesResultSchema.parse({
      conversationModeEnabled: true,
      chatAgentEnabled: true,
      chatAgentSupportByProvider: { ollama: 'unsupported', 'claude-sdk': 'edit' },
    })
    expect(parsed.chatAgentEnabled).toBe(true)
    expect(parsed.chatAgentSupportByProvider?.ollama).toBe('unsupported')
    expect(parsed.chatAgentSupportByProvider?.['claude-sdk']).toBe('edit')
  })

  it('defaults chatGateway to auto when omitted', () => {
    const parsed = desktopCapabilitiesResultSchema.parse({ conversationModeEnabled: false })
    expect(parsed.chatGateway).toBe('auto')
    expect(parsed.devProvidersAvailable).toBe(false)
  })

  it('accepts devProvidersAvailable flag', () => {
    const parsed = desktopCapabilitiesResultSchema.parse({
      conversationModeEnabled: false,
      devProvidersAvailable: true,
    })
    expect(parsed.devProvidersAvailable).toBe(true)
  })

  it('accepts list and search payloads', () => {
    const listInput = parseIpcInput(
      conversationHistoryListInputSchema,
      { workspacePath: '/repo/ws', limit: 100 },
      IPC_CHANNELS.conversationHistoryList,
    )
    expect(listInput?.workspacePath).toBe('/repo/ws')

    const searchInput = parseIpcInput(
      conversationHistorySearchInputSchema,
      { query: 'auth bug', workspacePath: '/repo/ws', limit: 50 },
      IPC_CHANNELS.conversationHistorySearch,
    )
    expect(searchInput.query).toBe('auth bug')
  })

  it('accepts get and delete payloads', () => {
    const getInput = parseIpcInput(
      conversationHistoryGetInputSchema,
      { threadId: 'thr_1' },
      IPC_CHANNELS.conversationHistoryGet,
    )
    expect(getInput.threadId).toBe('thr_1')

    const deleteInput = parseIpcInput(
      conversationHistoryDeleteInputSchema,
      { threadId: 'thr_1' },
      IPC_CHANNELS.conversationHistoryDelete,
    )
    expect(deleteInput.threadId).toBe('thr_1')
  })

  it('accepts list/search/get/delete result payloads', () => {
    const listResult = conversationHistoryListResultSchema.parse({ threads: [] })
    expect(listResult.threads).toEqual([])

    const searchResult = conversationHistorySearchResultSchema.parse({ threads: [] })
    expect(searchResult.threads).toEqual([])

    const getResult = conversationHistoryGetResultSchema.parse({ found: false })
    expect(getResult.found).toBe(false)

    const deleteResult = conversationHistoryDeleteResultSchema.parse({ ok: true, deleted: true })
    expect(deleteResult.ok).toBe(true)
    expect(deleteResult.deleted).toBe(true)
  })

  it('registers conversation history bridge methods and channels', () => {
    expect(BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'getDesktopCapabilities')?.channel).toBe(
      IPC_CHANNELS.desktopGetCapabilities,
    )
    expect(
      BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'listConversationHistory')?.channel,
    ).toBe(IPC_CHANNELS.conversationHistoryList)
    expect(BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'getConversationHistory')?.channel).toBe(
      IPC_CHANNELS.conversationHistoryGet,
    )
    expect(
      BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'deleteConversationHistory')?.channel,
    ).toBe(IPC_CHANNELS.conversationHistoryDelete)
    expect(
      BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'searchConversationHistory')?.channel,
    ).toBe(IPC_CHANNELS.conversationHistorySearch)
  })
})

describe('engine config IPC schemas', () => {
  it('accepts partial engine config update', () => {
    const parsed = parseIpcInput(
      engineConfigUpdateInputSchema,
      { provider: 'anthropic' },
      'engineConfig:update',
    )
    expect(parsed.provider).toBe('anthropic')
  })

  it('accepts workflow import from takt', () => {
    const parsed = parseIpcInput(
      workflowImportFromTaktInputSchema,
      { name: 'default', overwrite: true },
      'workflow:importFromTakt',
    )
    expect(parsed.name).toBe('default')
    expect(parsed.overwrite).toBe(true)
  })

  it('accepts engine config import options', () => {
    const parsed = parseIpcInput(
      engineConfigImportInputSchema,
      { overwrite: false },
      'engineConfig:importFromTakt',
    )
    expect(parsed.overwrite).toBe(false)
  })

  it('accepts provider model selection persistence payloads', () => {
    const parsed = parseIpcInput(
      rememberProviderModelSelectionInputSchema,
      { provider: 'cursor', model: 'composer-2.5' },
      IPC_CHANNELS.providerModelSelectionRemember,
    )
    expect(parsed).toEqual({ provider: 'cursor', model: 'composer-2.5' })
    expect(
      BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'rememberProviderModelSelection')?.channel,
    ).toBe(IPC_CHANNELS.providerModelSelectionRemember)
  })

  it('accepts facet read/write/delete ipc payloads', () => {
    const read = parseIpcInput(
      facetReadInputSchema,
      { kind: 'personas', key: 'planner', source: 'builtin' },
      IPC_CHANNELS.facetRead,
    )
    expect(read.key).toBe('planner')

    const write = parseIpcInput(
      facetWriteProjectInputSchema,
      { kind: 'policies', key: 'coding', content: '# Policy\n' },
      IPC_CHANNELS.facetWriteProject,
    )
    expect(write.content).toContain('Policy')

    const del = parseIpcInput(
      facetDeleteProjectInputSchema,
      { kind: 'knowledge', key: 'architecture' },
      IPC_CHANNELS.facetDeleteProject,
    )
    expect(del.kind).toBe('knowledge')
  })

  it('accepts canonical import confirm with optional home global flag', () => {
    const parsed = parseIpcInput(
      canonicalImportConfirmInputSchema,
      { importHomeGlobal: true },
      IPC_CHANNELS.canonicalImportConfirm,
    )
    expect(parsed.importHomeGlobal).toBe(true)
  })

  it('accepts takt global import from home with optional overwrite', () => {
    const parsed = parseIpcInput(
      taktGlobalImportFromHomeInputSchema,
      { overwrite: true },
      IPC_CHANNELS.taktGlobalImportFromHome,
    )
    expect(parsed.overwrite).toBe(true)
  })

  it('accepts agent overrides and yaml open ipc payloads', () => {
    const overrides = parseIpcInput(
      agentOverridesUpdateInputSchema,
      { persona_providers: { coder: { provider: 'anthropic', model: 'claude' } } },
      IPC_CHANNELS.agentOverridesUpdate,
    )
    expect(overrides.persona_providers?.coder).toEqual({
      provider: 'anthropic',
      model: 'claude',
    })

    const yamlOpen = parseIpcInput(
      yamlOpenInputSchema,
      { target: 'workflow', workflowName: 'default' },
      IPC_CHANNELS.yamlOpen,
    )
    expect(yamlOpen.target).toBe('workflow')
    expect(yamlOpen.workflowName).toBe('default')
  })

  it('accepts github issue fetch ipc payload', () => {
    const parsed = parseIpcInput(
      githubIssueFetchInputSchema,
      { ref: 'guilz-dev/planetz#368' },
      IPC_CHANNELS.githubIssueFetch,
    )
    expect(parsed.ref).toBe('guilz-dev/planetz#368')
  })

  it('accepts github issue list-open ipc payload', () => {
    const parsed = parseIpcInput(
      githubIssueListOpenInputSchema,
      { after: 'cursor-1' },
      IPC_CHANNELS.githubIssueListOpen,
    )
    expect(parsed.after).toBe('cursor-1')
  })

  it('registers agent overrides bridge methods with ipc channels', () => {
    for (const method of ['getAgentOverrides', 'updateAgentOverrides', 'openYaml'] as const) {
      const entry = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === method)
      expect(entry, `missing bridge manifest entry for ${method}`).toBeDefined()
    }
    expect(
      BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'updateAgentOverrides')?.broadcasts,
    ).toBe(true)
    expect(BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'openYaml')?.broadcasts).toBe(false)
  })

  it('registers facet bridge methods with ipc channels', () => {
    const facetMethods = [
      'listProjectFacets',
      'readFacet',
      'writeProjectFacet',
      'deleteProjectFacet',
      'listFacetUsages',
    ] as const
    for (const method of facetMethods) {
      const entry = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === method)
      expect(entry, `missing bridge manifest entry for ${method}`).toBeDefined()
      expect(entry?.channel.startsWith('facet:')).toBe(true)
    }
  })

  it('registers fetchGitHubIssue bridge method', () => {
    const entry = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'fetchGitHubIssue')
    expect(entry?.channel).toBe(IPC_CHANNELS.githubIssueFetch)
    expect(entry?.broadcasts).toBe(false)
  })

  it('registers listOpenGitHubIssues bridge method', () => {
    const entry = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'listOpenGitHubIssues')
    expect(entry?.channel).toBe(IPC_CHANNELS.githubIssueListOpen)
    expect(entry?.broadcasts).toBe(false)
  })

  it('accepts create result pr ipc payload', () => {
    const parsed = parseIpcInput(
      createResultPrInputSchema,
      { taskId: 'task-1', branch: 'feature/demo', title: 'Demo PR' },
      IPC_CHANNELS.resultCreatePr,
    )
    expect(parsed.taskId).toBe('task-1')
    expect(parsed.branch).toBe('feature/demo')
    expect(parsed.title).toBe('Demo PR')
  })

  it('accepts result check branch ipc payload', () => {
    const parsed = parseIpcInput(
      resultCheckBranchInputSchema,
      { taskId: 'task-1', branch: 'feature/demo' },
      IPC_CHANNELS.resultCheckBranch,
    )
    expect(parsed.taskId).toBe('task-1')
    expect(parsed.branch).toBe('feature/demo')
  })

  it('registers createResultPr and checkResultBranch bridge methods', () => {
    const createPr = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'createResultPr')
    const checkBranch = BRIDGE_INVOKE_MANIFEST.find((m) => m.method === 'checkResultBranch')
    expect(createPr?.channel).toBe(IPC_CHANNELS.resultCreatePr)
    expect(createPr?.broadcasts).toBe(true)
    expect(checkBranch?.channel).toBe(IPC_CHANNELS.resultCheckBranch)
    expect(checkBranch?.broadcasts).toBe(false)
  })
})
