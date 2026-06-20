import {
  type AppState,
  type ComposerAssistantFinalizeResult,
  DEFAULT_CONFIG,
  type DesktopCapabilitiesResult,
  type IntegrationsState,
} from '@planetz/shared'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { vi } from 'vitest'

/** In-memory Storage for node/jsdom hook tests. */
export function createStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

/** Full desktop capabilities object for bridge stubs and test overrides. */
export function desktopCapabilities(
  overrides: Partial<DesktopCapabilitiesResult> = {},
): DesktopCapabilitiesResult {
  return {
    conversationModeEnabled: false,
    chatGateway: 'auto',
    devProvidersAvailable: false,
    chatAgentEnabled: false,
    ...overrides,
  }
}

export const DEFAULT_INTEGRATIONS_STATE: IntegrationsState = {
  hookServer: { enabled: false, bind: '127.0.0.1', port: 17_840, hasSecret: false },
  adapters: [],
}

/** Minimal `AppState` for bootstrap hook tests. */
export function minimalAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    workspace: {
      id: 'ws-test',
      name: 'test',
      path: '/tmp/test-ws',
      sidecarPath: '/tmp/test-ws/.orbit',
      isWritable: true,
      bootstrap: 'takt_ready',
    },
    connection: { cli: 'ok', watch: 'stopped' },
    agents: [],
    executors: [],
    workflows: [],
    tasks: [],
    retries: [],
    results: [],
    chains: [],
    integrations: DEFAULT_INTEGRATIONS_STATE,
    mockQueueEnabled: false,
    ...overrides,
  }
}

function stubWindow(orbit: OrbitBridge, storage: Storage): void {
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { orbit, localStorage: storage }))
}

/** Full default `OrbitBridge` stub; override only what a test exercises. */
export function createDefaultOrbitBridge(overrides: Partial<OrbitBridge> = {}): OrbitBridge {
  const integrations = DEFAULT_INTEGRATIONS_STATE
  return {
    onStateUpdate: vi.fn(() => () => {}),
    onComposerSessionStream: vi.fn(() => () => {}),
    onUiFocusTask: vi.fn(() => () => {}),
    selectWorkspace: vi.fn(async () => ({ canceled: true as const })),
    getWorkspace: vi.fn(async () => ({ path: null, state: null })),
    getWorkspaceCurrentGitBranch: vi.fn(async () => ({ branch: 'main' })),
    listWorkspaceGitBranches: vi.fn(async () => ({ branches: ['main'], currentBranch: 'main' })),
    listRecentWorkspaces: vi.fn(async () => []),
    openRecentWorkspace: vi.fn(async () => ({
      path: '/tmp/ws',
      state: minimalAppState(),
    })),
    removeRecentWorkspace: vi.fn(async () => []),
    setBootstrapStatus: vi.fn(async () => minimalAppState()),
    getDesktopCapabilities: vi.fn(async () => desktopCapabilities()),
    enqueueTask: vi.fn(async () => ({ taskId: 'task-1' })),
    retryTask: vi.fn(async () => ({ taskId: 'task-1' })),
    resumeTask: vi.fn(async () => ({ taskId: 'task-1' })),
    stopTask: vi.fn(async () => {}),
    resumeStoppedTask: vi.fn(async () => {}),
    reviseTask: vi.fn(async () => ({ taskId: 'task-1' })),
    deleteTask: vi.fn(async () => {}),
    runTaskNow: vi.fn(async () => ({ taskId: 'task-1' })),
    runPendingTask: vi.fn(async () => {}),
    openTaskWorkDir: vi.fn(async () => ({ status: 'opened' as const, path: '/tmp/work' })),
    openTaskResultPath: vi.fn(async () => ({ status: 'opened' as const, path: '/tmp/report.md' })),
    listConversationsForTask: vi.fn(async () => []),
    listConversationHistory: vi.fn(async () => ({ threads: [] })),
    getConversationHistory: vi.fn(async () => ({ found: false as const })),
    deleteConversationHistory: vi.fn(async () => ({ ok: true as const, deleted: false })),
    searchConversationHistory: vi.fn(async () => ({ threads: [] })),
    getChatComposerDraft: vi.fn(async () => ({ snapshot: null })),
    saveChatComposerDraft: vi.fn(async () => ({ ok: true as const })),
    recordChatToTaskMetric: vi.fn(async () => {}),
    getTaskResult: vi.fn(async (input) => ({
      taskId: input.taskId,
      reports: [],
      status: 'no_reports' as const,
    })),
    listTaskResultDiff: vi.fn(async (input) => ({
      taskId: input.taskId,
      branch: input.branch,
      baseRef: 'main',
      files: [],
    })),
    getTaskResultDiffFile: vi.fn(async (input) => ({
      path: input.path,
      status: 'modified' as const,
      lines: [],
      additions: 0,
      deletions: 0,
    })),
    mergeResult: vi.fn(async () => ''),
    createResultPr: vi.fn(async () => ({
      status: 'created' as const,
      pr: {
        number: 1,
        url: 'https://github.com/o/r/pull/1',
        state: 'open' as const,
        isDraft: false,
        headBranch: 'feature',
        baseBranch: 'main',
      },
    })),
    checkResultBranch: vi.fn(async () => ({ exists: true, defaultBaseBranch: 'main' })),
    initializeWorkspace: vi.fn(async () => minimalAppState()),
    startWatch: vi.fn(async () => ({ cli: 'ok' as const, watch: 'running' as const })),
    stopWatch: vi.fn(async () => ({ cli: 'ok' as const, watch: 'stopped' as const })),
    listPromptHistory: vi.fn(async () => []),
    deletePromptHistoryItem: vi.fn(async () => {}),
    startComposerSession: vi.fn(async () => ({
      sessionId: 'composer_test',
      question: 'What is the scope?',
      recommendedAnswer: 'Fix login bug',
      turnIndex: 1,
      readyToFinalize: false,
    })),
    messageComposerSession: vi.fn(async () => ({
      sessionId: 'composer_test',
      question: 'Any constraints?',
      recommendedAnswer: 'No breaking changes',
      turnIndex: 2,
      readyToFinalize: true,
    })),
    finalizeComposerSession: vi.fn(async () => ({
      sessionId: 'composer_test',
      body: 'Fix the login bug without breaking changes.',
    })),
    acceptComposerSession: vi.fn(
      async (): Promise<ComposerAssistantFinalizeResult> => ({
        sessionId: 'composer_test',
        body: 'Accepted assistant draft',
        allowedActions: ['execute', 'save_task'],
      }),
    ),
    playComposerSession: vi.fn(
      async (): Promise<ComposerAssistantFinalizeResult> => ({
        sessionId: 'composer_test',
        body: 'Play task draft',
        allowedActions: ['execute', 'save_task'],
      }),
    ),
    buildComposerSourceContext: vi.fn(async () => ({
      sourceContext: '## Issue #1: Example',
    })),
    cancelComposerSession: vi.fn(async () => {}),
    interruptComposerSession: vi.fn(async () => {}),
    getActiveComposerSession: vi.fn(async () => null),
    getChatSessionPendingChanges: vi.fn(async () => ({
      threadId: 'thread_test',
      composerSessionId: 'composer_test',
      baseRef: 'abc123',
      files: [],
    })),
    getChatSessionPendingChangeFile: vi.fn(async () => ({
      path: 'src/example.ts',
      status: 'modified' as const,
      lines: [],
      additions: 0,
      deletions: 0,
    })),
    applyChatSessionChanges: vi.fn(async () => ({ applied: [], skipped: [] })),
    listChatMcpPendingConsent: vi.fn(async () => ({ serverIds: [] })),
    grantChatMcpConsent: vi.fn(async () => {}),
    listChatMcpServersOverview: vi.fn(async () => ({
      secureStoreAvailable: false,
      servers: [],
    })),
    setChatMcpSecret: vi.fn(async () => ({ storage: 'fallback' as const })),
    getComposerAssistCapabilities: vi.fn(async () => ({
      startMode: 'interactive-assistant' as const,
      headlessRunnerReady: true,
    })),
    resumeComposerSession: vi.fn(async () => ({
      sessionId: 'composer_test',
      turns: [],
      readyToFinalize: false,
      turnIndex: 0,
    })),
    getWorkflowPreview: vi.fn(async () => ({
      name: 'default',
      source: 'project' as const,
      features: {
        workflowName: 'default',
        source: 'project' as const,
        canCompleteWithoutEditing: false,
        canCompleteBeforeFirstEdit: false,
        forcesImplementationOnAllPaths: false,
        hasImplementationPath: true,
        forcesTestWriting: false,
        requiresClearSpec: false,
        changeMode: 'mixed' as const,
        primaryOutputs: ['code' as const],
        dominantModes: ['implement' as const],
        targetSurfaces: ['general' as const],
        hasWriteTestsStep: false,
        hasReviewLoop: false,
        hasFixLoop: false,
        hasParallelReview: false,
        hasWorkflowCall: false,
        hasLoopMonitor: false,
        personaKeys: [],
        policyKeys: [],
        knowledgeKeys: [],
        instructionKeys: [],
        reportFormatKeys: [],
        stepCount: 1,
        editStepCount: 1,
        reviewStepCount: 0,
        investigateStepCount: 0,
        auditStepCount: 0,
        evidence: [],
      },
      steps: [],
      strictTier: false,
      overridesAllowed: true,
    })),
    previewWorkflowAutoRoute: vi.fn(async () => ({
      previewToken: 'preview-token',
      promptHash: 'hash',
      phase: 'deterministic' as const,
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium' as const,
        score: 0.8,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
    })),
    swapTaskWorkflow: vi.fn(async (input) => ({
      taskId: input.taskId,
      workflow: input.workflow,
    })),
    listWorkflows: vi.fn(async () => []),
    readWorkflow: vi.fn(async () => ({ source: 'project' as const, yaml: '' })),
    readWorkflowFacets: vi.fn(async () => []),
    listWorkflowBuiltinFacets: vi.fn(async () => ({
      personas: [],
      policies: [],
      knowledge: [],
      instructions: [],
      reportFormats: [],
    })),
    listProjectFacets: vi.fn(async () => []),
    readFacet: vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'test',
      source: 'missing' as const,
      content: null,
      managedPath: '../facets/personas/test.md',
    })),
    writeProjectFacet: vi.fn(async () => ({ path: '.orbit/facets/personas/test.md' })),
    deleteProjectFacet: vi.fn(async () => {}),
    listFacetUsages: vi.fn(async () => ({ workflowCount: 0, stepCount: 0, workflowNames: [] })),
    writeProjectWorkflow: vi.fn(async () => ({ path: '/tmp/wf.yaml' })),
    installSpecDrivenWorkflow: vi.fn(async () => ({ path: '/tmp/spec-driven.yaml' })),
    validateWorkflow: vi.fn(async () => []),
    pickWorkflowImportYaml: vi.fn(async () => ({ canceled: true as const })),
    saveWorkflowDraft: vi.fn(async () => {}),
    loadWorkflowDraft: vi.fn(async () => ({ yaml: null })),
    deleteWorkflowDraft: vi.fn(async () => {}),
    createChainTask: vi.fn(async () => ({ chainId: 'chain-1', taskId: 'task-new' })),
    materializeChainEdge: vi.fn(async () => ({
      taskId: 'task-b',
      chainId: 'chain-1',
    })),
    checkChainSourceBranch: vi.fn(async () => ({ exists: true })),
    deleteChain: vi.fn(async () => {}),
    setChainEdgeStatus: vi.fn(async () => {}),
    toggleHookServer: vi.fn(async () => ({ state: integrations })),
    toggleAdapter: vi.fn(async () => integrations),
    pushExternalAgent: vi.fn(async () => {}),
    selectTask: vi.fn(async () => {}),
    getConnectionStatus: vi.fn(async () => ({ cli: 'ok' as const, watch: 'stopped' as const })),
    getSettings: vi.fn(async () => ({ workspacePath: null, config: null })),
    updateSettings: vi.fn(async () => ({
      config: DEFAULT_CONFIG,
      connection: { cli: 'ok' as const, watch: 'stopped' as const },
    })),
    getEngineConfig: vi.fn(async () => ({ config: {}, path: '/tmp/engine.yaml' })),
    getAgentOverrides: vi.fn(async () => ({
      overrides: {},
      path: '.orbit/agents/overrides.yaml',
    })),
    updateAgentOverrides: vi.fn(async () => ({
      overrides: {},
      path: '.orbit/agents/overrides.yaml',
      engineConfig: {},
      effectiveEngineConfig: {},
    })),
    openYaml: vi.fn(async () => ({ status: 'opened' as const, path: '.orbit/engine-config.yaml' })),
    listExecutionCatalog: vi.fn(async () => ({
      configuredProviders: [],
      runtimeDetectedProviders: [],
      modelsByProvider: {},
      effortsByProvider: {},
    })),
    listProviderModels: vi.fn(async () => ({ models: [] })),
    rememberProviderModelSelection: vi.fn(async () => ({ ok: true as const })),
    listModelHistory: vi.fn(async () => ({ items: [] })),
    deleteModelHistoryItem: vi.fn(async () => ({ ok: true as const })),
    listProviderEfforts: vi.fn(async () => ({ efforts: [] })),
    listEffortHistory: vi.fn(async () => ({ items: [] })),
    deleteEffortHistoryItem: vi.fn(async () => ({ ok: true as const })),
    updateEngineConfig: vi.fn(async () => ({ config: {}, path: '/tmp/engine.yaml' })),
    importGlobalTaktFromHome: vi.fn(async () => ({
      configImported: false,
      workflowsImported: [] as string[],
    })),
    importEngineConfigFromTakt: vi.fn(async () => ({
      config: {},
      path: '/tmp/engine.yaml',
      overwritten: false,
    })),
    importWorkflowFromTakt: vi.fn(async () => ({ path: '/tmp/wf.yaml', overwritten: false })),
    confirmCanonicalImport: vi.fn(async () => minimalAppState()),
    dismissCanonicalImport: vi.fn(async () => minimalAppState()),
    listPendingIntentLedger: vi.fn(async () => ({ entries: [] })),
    countPendingIntentLedger: vi.fn(async () => ({ count: 0 })),
    getIntentLedgerSummary: vi.fn(async () => ({
      window: '7d' as const,
      ingestedAssumedCount: 0,
      pendingCount: 0,
      ratifiedCount: 0,
      reversedCount: 0,
      adjudicationRate: null,
      scopeConflictCount: 0,
      unanchoredCount: 0,
      unanchoredRate: null,
      adjudicationLatencyP50Ms: null,
      ratifyRatio: null,
      reverseRatio: null,
      adoptCount: 0,
      fixCount: 0,
    })),
    listIntentLedgerByThread: vi.fn(async () => ({ entries: [], taskIds: [], trace: [] })),
    listSupplyIntentLedger: vi.fn(async () => ({ entries: [] })),
    listSpecThreadSummaries: vi.fn(async () => ({ summaries: [] })),
    getValidationCoverageSummary: vi.fn(async () => ({
      orphanReqCount: 0,
      nakedIntentThreadCount: 0,
      threads: [],
    })),
    getCurrentDecidedIntent: vi.fn(async () => ({ intent: null })),
    listDecidedIntentVersions: vi.fn(async () => ({ versions: [] })),
    saveDecidedIntent: vi.fn(async (input) => ({
      intent: {
        id: `${input.threadId}#v1`,
        threadId: input.threadId,
        version: 1,
        what: input.what,
        why: input.why,
        outOfScope: input.outOfScope ?? [],
        reason: input.reason ?? null,
        createdAt: new Date().toISOString(),
      },
    })),
    getIntentDraft: vi.fn(async () => ({ draft: null })),
    saveIntentDraft: vi.fn(async (input) => ({ draft: input })),
    generateIntentDraft: vi.fn(async () => ({ draft: null })),
    clearIntentDraft: vi.fn(async () => ({ ok: true as const })),
    ratifyIntentLedgerEntry: vi.fn(async () => ({ ok: true as const })),
    reverseIntentLedgerEntry: vi.fn(async () => ({ ok: true as const })),
    adoptIntentLedgerEntry: vi.fn(async () => ({ ok: true as const })),
    fixIntentLedgerEntry: vi.fn(async () => ({ ok: true as const })),
    listKiroSpecs: vi.fn(async () => ({ specs: [] })),
    getKiroSpec: vi.fn(async () => ({
      spec: { featureId: 'demo', specDirRel: '.kiro/specs/demo', parseStatus: 'missing' as const },
    })),
    listExecutionLog: vi.fn(async () => ({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 0,
      hasMore: false,
    })),
    getOllamaHealth: vi.fn(async () => null),
    previewOllamaExecutionGuard: vi.fn(async () => ({ action: 'allow' as const, issues: [] })),
    pullOllamaModel: vi.fn(async () => ({ ok: true as const })),
    deleteOllamaModel: vi.fn(async () => ({ ok: true as const })),
    listOpenGitHubIssues: vi.fn(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      items: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    })),
    fetchGitHubIssue: vi.fn(async () => ({
      repository: { owner: 'guilz-dev', name: 'planetz' },
      number: 368,
      title: 'Sample issue',
      body: 'Issue body',
      url: 'https://github.com/guilz-dev/planetz/issues/368',
      state: 'open' as const,
      labels: [],
      author: 'kaz',
    })),
    getExecutionSummary: vi.fn(async () => ({
      window: '7d' as const,
      total: 0,
      completed: 0,
      failureCount: 0,
      successRate: 0,
      byStatus: [
        { status: 'completed' as const, count: 0 },
        { status: 'failed' as const, count: 0 },
        { status: 'exceeded' as const, count: 0 },
      ],
      byExecutor: [],
      byWorkflow: [],
    })),
    ...overrides,
  }
}

/** Install `window.orbit` and in-memory `localStorage` (canonical for tests). */
export function installOrbitMockWithStorage(overrides: Partial<OrbitBridge> = {}): {
  orbit: OrbitBridge
  storage: Storage
} {
  const storage = createStorageMock()
  const orbit = createDefaultOrbitBridge(overrides)
  stubWindow(orbit, storage)
  return { orbit, storage }
}

/** Install mocks and return the orbit stub only. */
export function installOrbitMock(overrides: Partial<OrbitBridge> = {}): OrbitBridge {
  return installOrbitMockWithStorage(overrides).orbit
}
