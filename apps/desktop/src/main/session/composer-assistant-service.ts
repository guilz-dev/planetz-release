import { randomUUID } from 'node:crypto'
import {
  type ChatApplySessionMeta,
  COMPOSER_ASSISTANT_MAX_TURNS,
  type ComposerAssistActiveSession,
  type ComposerAssistantFinalizeResult,
  type ComposerAssistantTurn,
  type ComposerAssistDraftKey,
  type ComposerAssistSessionSnapshot,
  type ComposerAssistTurnRecord,
  type ComposerSessionAcceptInput,
  type ComposerSessionCancelInput,
  type ComposerSessionFinalizeInput,
  type ComposerSessionInterruptInput,
  type ComposerSessionMessageInput,
  type ComposerSessionPlayInput,
  type ComposerSessionResumeInput,
  type ComposerSessionStartInput,
  composerAssistDraftMatchesInput,
  composerSessionNotFoundMessage,
  composerSourceContextRequiresInteractiveMessage,
  createComposerStreamAbortedLine,
  type EngineConfig,
  type EnqueueTaskInput,
  isOrbitInteractiveAssistEnabled,
  type McpServersFile,
  normalizeComposerAssistSourceContext,
  type OrbitInteractiveSnapshot,
  type OrbitInteractiveStreamLine,
  parseChatMcpToolName,
  redactSecrets,
  resolveSessionPolicy,
  resolveSessionToolsProfile,
  writeEffortToProviderOptions,
} from '@planetz/shared'
import {
  askComposerAssistantTurn,
  ComposerLlmTimeoutError,
  finalizeComposerAssistant,
} from '../planetz/composer-llm-client.js'
import {
  assertOrbitInteractiveOk,
  orbitInteractiveAccept,
  orbitInteractiveFinalize,
  orbitInteractivePlay,
  orbitInteractiveStart,
  orbitInteractiveTurn,
} from '../planetz/orbit-interactive-client.js'
import type {
  ComposerAssistMetricOutcome,
  ComposerAssistMetricPhase,
  ComposerAssistMetricsStore,
} from '../sidecar/composer-assist-metrics-store.js'
import type { ComposerSessionStore } from '../sidecar/composer-session-store.js'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { upsertConversationArtifact } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { ComposerContextTooLargeError } from './composer-context-errors.js'
import type { ComposerConversationLedgerWriter } from './composer-conversation-ledger.js'
import { scheduleConversationTitleGeneration } from './composer-conversation-title.js'
import { prepareComposerMessageContext } from './conversation-context-pipeline.js'

interface ComposerChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface PlanningOnlySessionState {
  id: string
  mode: 'planning-only'
  workflow?: string
  provider: string
  model?: string
  effort?: string
  seedBody?: string
  messages: ComposerChatMessage[]
  turns: ComposerAssistTurnRecord[]
  assistantTurnCount: number
  readyToFinalize: boolean
}

interface InteractiveAssistantSessionState {
  id: string
  mode: 'interactive-assistant'
  workflow?: string
  provider: string
  model?: string
  effort?: string
  seedBody?: string
  orbitSnapshot: OrbitInteractiveSnapshot
  readyToFinalize: boolean
  /** Set when the session is backed by a conversation ledger thread (Chat View). */
  conversationLedgerWorkspacePath?: string
}

type ComposerSessionState = PlanningOnlySessionState | InteractiveAssistantSessionState
type OrbitInteractiveSnapshotWithMcp = OrbitInteractiveSnapshot & { mcpServers?: McpServersFile }

function shouldUseHeadlessInteractive(input: ComposerSessionStartInput): boolean {
  if (input.mode === 'interactive-assistant') return true
  if (input.mode === 'planning-only' && isOrbitInteractiveAssistEnabled()) return true
  return false
}

function resolveAssistBackendMode(
  input: ComposerSessionStartInput,
): 'planning-only' | 'interactive-assistant' {
  return shouldUseHeadlessInteractive(input) ? 'interactive-assistant' : 'planning-only'
}

function withEffortOverride(
  engineConfig: EngineConfig,
  provider: string,
  effort?: string,
): EngineConfig {
  const trimmedEffort = effort?.trim()
  if (!trimmedEffort) return engineConfig
  const currentProviderOptions = (engineConfig as Record<string, unknown>).provider_options
  const nextProviderOptions = writeEffortToProviderOptions(
    provider,
    trimmedEffort,
    currentProviderOptions,
  )
  const next = { ...engineConfig } as EngineConfig & { provider_options?: Record<string, unknown> }
  if (nextProviderOptions) {
    next.provider_options = nextProviderOptions
  } else {
    delete next.provider_options
  }
  return next
}

type McpToolArtifactItem = {
  id: string
  tool: string
  serverId: string
  toolName: string
  inputSummary?: string
  resultSummary?: string
  isError?: boolean
}

function mergeAllowedTools(base: string[], extras: string[] | undefined): string[] {
  if (!extras || extras.length === 0) return base
  return [...new Set([...base, ...extras])]
}

function summarizeArtifactValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? redactSecrets(trimmed).slice(0, 200) : undefined
  }
  if (value && typeof value === 'object') {
    try {
      return redactSecrets(JSON.stringify(value)).slice(0, 200)
    } catch {
      return undefined
    }
  }
  return undefined
}

function composerAssistDraftKeyFromSnapshot(
  snapshot: ComposerAssistSessionSnapshot,
): ComposerAssistDraftKey {
  return {
    seedBody: snapshot.seedBody,
    workflow: snapshot.workflow,
    effort: snapshot.effort,
    provider: snapshot.provider,
    model: snapshot.model,
    sourceContext:
      snapshot.mode === 'interactive-assistant' ? snapshot.orbitSnapshot.sourceContext : undefined,
    sessionPolicy:
      snapshot.mode === 'interactive-assistant' ? snapshot.orbitSnapshot.sessionPolicy : undefined,
  }
}

function composerAssistDraftKeyFromStartInput(
  input: ComposerSessionStartInput,
): ComposerAssistDraftKey {
  return {
    seedBody: input.seedBody,
    workflow: input.workflow,
    effort: input.effort,
    provider: input.provider,
    model: input.model,
    sourceContext: input.sourceContext,
    sessionPolicy: input.sessionPolicy,
  }
}

export class ComposerSessionNotFoundError extends Error {
  readonly code = 'not_found'

  constructor(sessionId: string) {
    super(composerSessionNotFoundMessage(sessionId))
    this.name = 'ComposerSessionNotFoundError'
  }
}

export interface ComposerAssistantServiceDeps {
  resolveExecutionProfile(input: EnqueueTaskInput): Promise<{
    provider?: string
    model?: string
    effort?: string
  }>
  loadEffectiveEngineConfig: () => Promise<EngineConfig>
  requireTaktRepoPath(): string
  requireIsolatedRepoPath(): string
  captureChatApplyBaseRef(): Promise<string>
  registerChatApplySessionMeta(meta: ChatApplySessionMeta): void
  unregisterChatApplySessionMeta(composerSessionId: string): void
  resolveMcpServersForAgent(providerId: string): Promise<McpServersFile | undefined>
  resolveMcpAllowedToolsForAgent(providerId: string): Promise<string[] | undefined>
  requireSidecarPaths: () => SidecarPaths
  sessionStore: ComposerSessionStore
  metricsStore: ComposerAssistMetricsStore
  conversationLedgerWriter?: ComposerConversationLedgerWriter
  conversationLedgerStore?: ConversationLedgerStore
  emitComposerStream?: (line: OrbitInteractiveStreamLine) => void
}

export class ComposerAssistantService {
  private sessions = new Map<string, ComposerSessionState>()
  private activeSessionId: string | null = null
  private inFlightMessageAborts = new Map<string, AbortController>()

  constructor(private readonly deps: ComposerAssistantServiceDeps) {}

  clearAll(): void {
    this.sessions.clear()
    this.activeSessionId = null
    for (const controller of this.inFlightMessageAborts.values()) {
      controller.abort()
    }
    this.inFlightMessageAborts.clear()
  }

  async getActive(): Promise<ComposerAssistActiveSession | null> {
    const inMemory = this.getActiveInMemory()
    if (inMemory) return inMemory

    const snapshot = await this.loadPersistedSnapshot()
    if (!snapshot) return null
    return this.toActiveSessionFromSnapshot(snapshot)
  }

  async resume(input: ComposerSessionResumeInput = {}): Promise<ComposerAssistActiveSession> {
    const inMemory = this.getActiveInMemory()
    if (inMemory && (!input.sessionId || input.sessionId === inMemory.sessionId)) {
      await this.attachLedgerWorkspaceFromStore(inMemory.sessionId)
      return inMemory
    }

    const snapshot = await this.loadPersistedSnapshot()
    if (!snapshot) {
      throw new ComposerSessionNotFoundError(input.sessionId ?? 'active')
    }
    if (input.sessionId && input.sessionId !== snapshot.sessionId) {
      throw new ComposerSessionNotFoundError(input.sessionId)
    }

    this.hydrateFromSnapshot(snapshot)
    await this.attachLedgerWorkspaceFromStore(snapshot.sessionId)
    const hydratedSession = this.requireSession(snapshot.sessionId)
    await this.ensureInteractiveSessionMcpServers(hydratedSession)
    return this.toActiveSessionFromState(hydratedSession)
  }

  async start(input: ComposerSessionStartInput): Promise<ComposerAssistantTurn> {
    const backendMode = resolveAssistBackendMode(input)

    if (input.forceNew) {
      await this.clearPersistedSnapshot()
      this.clearActiveInMemory()
    } else {
      const persisted = await this.loadPersistedSnapshot()
      if (
        persisted &&
        composerAssistDraftMatchesInput(
          composerAssistDraftKeyFromStartInput(input),
          composerAssistDraftKeyFromSnapshot(persisted),
        )
      ) {
        const existing = await this.getActive()
        if (existing) {
          await this.resume({ sessionId: existing.sessionId })
          const session = this.requireSession(existing.sessionId)
          if (session.mode === 'interactive-assistant') {
            const lastAssistant = [...session.orbitSnapshot.messages]
              .reverse()
              .find((m) => m.role === 'assistant')
            return this.toTurnFromInteractive(session, {
              kind: 'assistant_message',
              assistantMessage: lastAssistant?.content ?? '',
            })
          }
          return this.toTurnFromState(session)
        }
      } else if (persisted) {
        await this.clearPersistedSnapshot()
        this.clearActiveInMemory()
      }
    }

    try {
      const profile = await this.deps.resolveExecutionProfile({
        title: '',
        body: input.seedBody ?? '',
        workflow: input.workflow,
        provider: input.provider,
        model: input.model,
      })
      const provider = profile.provider?.trim()
      if (!provider) {
        throw new Error('No provider configured for Composer Assist')
      }
      const selectedEffort = input.effort?.trim()

      this.clearActiveInMemory()

      const sessionId = `composer_${crypto.randomUUID()}`
      const seedBody = input.seedBody?.trim() ? redactSecrets(input.seedBody.trim()) : undefined
      const sourceContext = input.sourceContext?.trim()
        ? normalizeComposerAssistSourceContext(redactSecrets(input.sourceContext.trim()))
        : undefined

      if (sourceContext && backendMode !== 'interactive-assistant') {
        throw new Error(composerSourceContextRequiresInteractiveMessage())
      }

      if (backendMode === 'interactive-assistant') {
        const engineConfig = withEffortOverride(
          await this.deps.loadEffectiveEngineConfig(),
          provider,
          selectedEffort,
        )
        const cwd = this.deps.requireTaktRepoPath()
        const workflow = input.workflow?.trim() || 'default'
        const sessionPolicy = resolveSessionPolicy(input)
        const toolsProfile = resolveSessionToolsProfile({ sessionPolicy })
        let agentApplyRegistered = false
        if (sessionPolicy === 'planetz-chat-agent' && input.conversationLedger) {
          const ledger = input.conversationLedger
          const existingThreadId = ledger.existingThreadId?.trim()
          if (existingThreadId && this.deps.conversationLedgerStore) {
            const paths = this.deps.requireSidecarPaths()
            const loaded = await this.deps.conversationLedgerStore.getWithTurns(
              paths,
              ledger.workspacePath,
              existingThreadId,
            )
            const previousSessionId = loaded?.thread.activeSessionId?.trim()
            if (previousSessionId && previousSessionId !== sessionId) {
              this.deps.unregisterChatApplySessionMeta(previousSessionId)
            }
          }
          const threadId = existingThreadId || sessionId
          const baseRef = await this.deps.captureChatApplyBaseRef()
          this.deps.registerChatApplySessionMeta({
            composerSessionId: sessionId,
            threadId,
            baseRef,
            isolatedRepoPath: this.deps.requireIsolatedRepoPath(),
            workspacePath: ledger.workspacePath,
            capturedAt: new Date().toISOString(),
          })
          agentApplyRegistered = true
        }
        const [mcpServers, mcpAllowedTools] =
          sessionPolicy === 'planetz-chat-agent'
            ? await Promise.all([
                this.deps.resolveMcpServersForAgent(provider),
                this.deps.resolveMcpAllowedToolsForAgent(provider),
              ])
            : [undefined, undefined]
        const response = await orbitInteractiveStart({
          cwd,
          workflow,
          planetzSessionId: sessionId,
          provider,
          model: profile.model ?? input.model,
          ...(selectedEffort ? { effort: selectedEffort } : {}),
          seedBody,
          sourceContext,
          sessionPolicy,
          toolsProfile,
          ...(mcpServers ? { mcpServers } : {}),
          ...(mcpAllowedTools ? { allowedToolsOverride: mcpAllowedTools } : {}),
          engineConfig,
        })
        assertOrbitInteractiveOk(response)
        if (!response.nextSnapshot) {
          throw new Error('Headless interactive start returned no snapshot')
        }
        const responseSnapshot = response.nextSnapshot as OrbitInteractiveSnapshotWithMcp
        const withMcpServers =
          mcpServers && !responseSnapshot.mcpServers
            ? { ...responseSnapshot, mcpServers }
            : responseSnapshot
        const nextSnapshot =
          mcpAllowedTools && mcpAllowedTools.length > 0
            ? {
                ...withMcpServers,
                allowedTools: mergeAllowedTools(withMcpServers.allowedTools, mcpAllowedTools),
              }
            : withMcpServers
        const session: InteractiveAssistantSessionState = {
          id: sessionId,
          mode: 'interactive-assistant',
          workflow: input.workflow,
          provider,
          model: profile.model ?? input.model,
          ...(selectedEffort ? { effort: selectedEffort } : {}),
          seedBody,
          orbitSnapshot: nextSnapshot,
          readyToFinalize: nextSnapshot.messages.some((m) => m.role === 'assistant'),
          ...(input.conversationLedger
            ? { conversationLedgerWorkspacePath: input.conversationLedger.workspacePath }
            : {}),
        }
        this.sessions.set(session.id, session)
        this.activeSessionId = session.id
        await this.persistSession(session)
        if (this.deps.conversationLedgerWriter && input.conversationLedger) {
          try {
            await this.deps.conversationLedgerWriter.createThreadOnStartSuccess(input, sessionId)
          } catch (ledgerError: unknown) {
            if (agentApplyRegistered) {
              this.deps.unregisterChatApplySessionMeta(sessionId)
            }
            await this.clearInteractiveSession(session)
            throw ledgerError
          }
        }
        const turn = this.toTurnFromInteractive(session, response.result)
        await this.recordMetric('start', 'success')
        return turn
      }

      const session: PlanningOnlySessionState = {
        id: sessionId,
        mode: 'planning-only',
        workflow: input.workflow,
        provider,
        model: profile.model ?? input.model,
        ...(selectedEffort ? { effort: selectedEffort } : {}),
        seedBody,
        messages: [],
        turns: [],
        assistantTurnCount: 0,
        readyToFinalize: false,
      }

      this.sessions.set(session.id, session)
      this.activeSessionId = session.id
      const turn = await this.askNext(session)
      await this.recordMetric('start', 'success')
      return turn
    } catch (error) {
      await this.recordMetric('start', this.metricOutcomeFromError(error))
      throw error
    }
  }

  async message(input: ComposerSessionMessageInput): Promise<ComposerAssistantTurn> {
    try {
      const session = await this.requireSessionHydrated(input.sessionId)
      const trimmed = redactSecrets(input.message.trim())

      if (session.mode === 'interactive-assistant') {
        if (this.interactiveAtMaxTurns(session.orbitSnapshot)) {
          session.readyToFinalize = true
          await this.persistSession(session)
          return this.toTurnFromInteractive(session, {
            kind: 'assistant_message',
            assistantMessage: '',
          })
        }
        const contextPrep = await prepareComposerMessageContext({
          snapshot: session.orbitSnapshot,
          pendingUserMessage: trimmed,
          attachments: input.attachments,
          model: session.model,
          sessionId: session.id,
          ledgerStore: this.deps.conversationLedgerStore,
          sidecarPaths: this.deps.conversationLedgerStore
            ? this.deps.requireSidecarPaths()
            : undefined,
        })
        if (contextPrep.blocked && contextPrep.compactionSummary) {
          await this.recordMetric('message', 'error')
          throw new ComposerContextTooLargeError(contextPrep.compactionSummary)
        }

        session.orbitSnapshot = contextPrep.snapshotForOrbit
        const engineConfig = withEffortOverride(
          await this.deps.loadEffectiveEngineConfig(),
          session.provider,
          session.effort,
        )
        const abortController = new AbortController()
        this.inFlightMessageAborts.set(session.id, abortController)
        const mcpToolArtifacts = new Map<string, McpToolArtifactItem>()
        const knownMcpServerIds = new Set(
          Object.keys((session.orbitSnapshot as OrbitInteractiveSnapshotWithMcp).mcpServers ?? {}),
        )
        let response: Awaited<ReturnType<typeof orbitInteractiveTurn>>
        try {
          response = await orbitInteractiveTurn(
            session.orbitSnapshot,
            contextPrep.messageForOrbit,
            {
              engineConfig,
              signal: abortController.signal,
              onStreamLine: (line) => {
                this.deps.emitComposerStream?.(line)
                this.collectMcpToolArtifactsFromStreamLine(
                  mcpToolArtifacts,
                  line,
                  knownMcpServerIds,
                )
              },
            },
          )
        } finally {
          this.inFlightMessageAborts.delete(session.id)
        }
        assertOrbitInteractiveOk(response)
        if (!response.nextSnapshot) {
          throw new Error('Headless interactive turn returned no snapshot')
        }
        session.orbitSnapshot = response.nextSnapshot
        session.readyToFinalize = session.orbitSnapshot.messages.some((m) => m.role === 'assistant')
        await this.persistSession(session)
        const turn = this.toTurnFromInteractive(session, response.result, {
          compactionSummary: contextPrep.compactionSummary,
        })
        const assistantContent = turn.assistantMessage?.trim() ?? ''
        if (
          this.deps.conversationLedgerWriter &&
          session.conversationLedgerWorkspacePath &&
          assistantContent
        ) {
          await this.deps.conversationLedgerWriter.appendInteractiveMessage(
            session.id,
            session.conversationLedgerWorkspacePath,
            trimmed,
            assistantContent,
            session.provider,
          )
          scheduleConversationTitleGeneration({
            sessionId: session.id,
            workspacePath: session.conversationLedgerWorkspacePath,
            userMessage: trimmed,
            assistantMessage: assistantContent,
            ledgerStore: this.deps.conversationLedgerStore,
            requireSidecarPaths: () => this.deps.requireSidecarPaths(),
            provider: session.provider,
            model: session.model,
            cwd: this.deps.requireTaktRepoPath(),
            loadEngineConfig: () => this.deps.loadEffectiveEngineConfig(),
          })
        }
        await this.persistMcpToolArtifacts(session, [...mcpToolArtifacts.values()])
        await this.recordMetric('message', 'success')
        return turn
      }

      this.attachUserReply(session, trimmed)
      session.messages.push({ role: 'user', content: trimmed })
      await this.persistSession(session)
      const turn = await this.askNext(session)
      await this.recordMetric('message', 'success')
      return turn
    } catch (error) {
      await this.recordMetric('message', this.metricOutcomeFromError(error))
      throw error
    }
  }

  async finalize(input: ComposerSessionFinalizeInput): Promise<ComposerAssistantFinalizeResult> {
    const session = await this.requireSessionHydrated(input.sessionId)
    try {
      if (session.mode === 'interactive-assistant') {
        const engineConfig = withEffortOverride(
          await this.deps.loadEffectiveEngineConfig(),
          session.provider,
          session.effort,
        )
        const response = await orbitInteractiveFinalize(
          session.orbitSnapshot,
          undefined,
          engineConfig,
        )
        assertOrbitInteractiveOk(response)
        if (response.result.kind !== 'summary') {
          throw new Error('Expected summary result from headless finalize')
        }
        await this.clearLedgerActiveSession(session)
        await this.clearInteractiveSession(session)
        await this.recordMetric('finalize', 'success')
        return {
          sessionId: session.id,
          body: redactSecrets(response.result.task),
          allowedActions: response.result.allowedActions,
        }
      }

      const engineConfig = withEffortOverride(
        await this.deps.loadEffectiveEngineConfig(),
        session.provider,
        session.effort,
      )
      const result = await finalizeComposerAssistant({
        provider: session.provider,
        model: session.model,
        cwd: this.deps.requireTaktRepoPath(),
        workflow: session.workflow,
        seedBody: session.seedBody,
        messages: session.messages,
        engineConfig,
      })
      this.sessions.delete(session.id)
      if (this.activeSessionId === session.id) {
        this.activeSessionId = null
      }
      await this.clearPersistedSnapshot()
      await this.recordMetric('finalize', 'success')
      return {
        sessionId: session.id,
        body: redactSecrets(result.body),
      }
    } catch (error) {
      await this.persistSession(session)
      await this.recordMetric('finalize', this.metricOutcomeFromError(error))
      throw error
    }
  }

  async accept(input: ComposerSessionAcceptInput): Promise<ComposerAssistantFinalizeResult> {
    const session = await this.requireSessionHydrated(input.sessionId)
    if (session.mode !== 'interactive-assistant') {
      throw new Error('Accept is only available for interactive-assistant sessions')
    }
    try {
      const response = await orbitInteractiveAccept(session.orbitSnapshot)
      assertOrbitInteractiveOk(response)
      if (response.result.kind !== 'accept') {
        throw new Error('Expected accept result from headless interactive')
      }
      await this.clearLedgerActiveSession(session)
      await this.clearInteractiveSession(session)
      // Counted under finalize metrics until accept-specific counters exist.
      await this.recordMetric('finalize', 'success')
      return {
        sessionId: session.id,
        body: redactSecrets(response.result.task),
        allowedActions: response.result.allowedActions,
      }
    } catch (error) {
      await this.persistSession(session)
      await this.recordMetric('finalize', this.metricOutcomeFromError(error))
      throw error
    }
  }

  async play(input: ComposerSessionPlayInput): Promise<ComposerAssistantFinalizeResult> {
    const session = await this.requireSessionHydrated(input.sessionId)
    if (session.mode !== 'interactive-assistant') {
      throw new Error('Play is only available for interactive-assistant sessions')
    }
    const task = redactSecrets(input.task.trim())
    try {
      const response = await orbitInteractivePlay(session.orbitSnapshot, task)
      assertOrbitInteractiveOk(response)
      if (response.result.kind !== 'play') {
        throw new Error('Expected play result from headless interactive')
      }
      await this.clearLedgerActiveSession(session)
      await this.clearInteractiveSession(session)
      // Counted under finalize metrics until play-specific counters exist.
      await this.recordMetric('finalize', 'success')
      return {
        sessionId: session.id,
        body: redactSecrets(response.result.task),
        allowedActions: response.result.allowedActions,
      }
    } catch (error) {
      await this.persistSession(session)
      await this.recordMetric('finalize', this.metricOutcomeFromError(error))
      throw error
    }
  }

  async cancel(input: ComposerSessionCancelInput): Promise<void> {
    if (!this.sessions.has(input.sessionId)) {
      const snapshot = await this.loadPersistedSnapshot()
      if (snapshot?.sessionId === input.sessionId) {
        await this.clearPersistedSnapshot()
      }
      return
    }
    this.sessions.delete(input.sessionId)
    if (this.activeSessionId === input.sessionId) {
      this.activeSessionId = null
    }
    await this.clearPersistedSnapshot()
  }

  async interrupt(input: ComposerSessionInterruptInput): Promise<void> {
    const hadInFlight = this.inFlightMessageAborts.has(input.sessionId)
    this.inFlightMessageAborts.get(input.sessionId)?.abort()
    if (hadInFlight && this.deps.emitComposerStream) {
      this.deps.emitComposerStream(createComposerStreamAbortedLine(input.sessionId))
    }
  }

  private getActiveInMemory(): ComposerAssistActiveSession | null {
    if (!this.activeSessionId) return null
    const session = this.sessions.get(this.activeSessionId)
    if (!session) return null
    return this.toActiveSessionFromState(session)
  }

  private clearActiveInMemory(): void {
    if (this.activeSessionId) {
      this.sessions.delete(this.activeSessionId)
      this.activeSessionId = null
    }
  }

  private requireSession(sessionId: string): ComposerSessionState {
    const session = this.sessions.get(sessionId)
    if (!session) throw new ComposerSessionNotFoundError(sessionId)
    return session
  }

  /** Restores from sidecar when main memory was cleared (e.g. dev reload, workspace teardown). */
  private async requireSessionHydrated(sessionId: string): Promise<ComposerSessionState> {
    const snapshot = await this.loadPersistedSnapshot()
    if (!this.sessions.has(sessionId) && snapshot?.sessionId === sessionId) {
      this.hydrateFromSnapshot(snapshot)
    }
    await this.attachLedgerWorkspaceFromStore(sessionId)
    const session = this.requireSession(sessionId)
    await this.ensureInteractiveSessionMcpServers(session)
    return session
  }

  private async ensureInteractiveSessionMcpServers(session: ComposerSessionState): Promise<void> {
    if (session.mode !== 'interactive-assistant') return
    if (session.orbitSnapshot.sessionPolicy !== 'planetz-chat-agent') return
    const snapshotWithMcp = session.orbitSnapshot as OrbitInteractiveSnapshotWithMcp
    const [mcpServers, mcpAllowedTools] = await Promise.all([
      snapshotWithMcp.mcpServers
        ? Promise.resolve(undefined)
        : this.deps.resolveMcpServersForAgent(session.provider),
      this.deps.resolveMcpAllowedToolsForAgent(session.provider),
    ])
    session.orbitSnapshot = {
      ...snapshotWithMcp,
      ...(mcpServers ? { mcpServers } : {}),
      ...(mcpAllowedTools
        ? {
            allowedTools: mergeAllowedTools(snapshotWithMcp.allowedTools, mcpAllowedTools),
          }
        : {}),
    }
  }

  private async attachLedgerWorkspaceFromStore(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session?.mode !== 'interactive-assistant' || session.conversationLedgerWorkspacePath) return
    const store = this.deps.conversationLedgerStore
    if (!store) return
    const paths = this.deps.requireSidecarPaths()
    const workspacePath = await store.findWorkspaceByActiveSessionId(paths, sessionId)
    if (workspacePath) {
      session.conversationLedgerWorkspacePath = workspacePath
    }
  }

  private collectMcpToolArtifactsFromStreamLine(
    collector: Map<string, McpToolArtifactItem>,
    line: OrbitInteractiveStreamLine,
    knownServerIds: ReadonlySet<string>,
  ): void {
    const event = line.event
    if (!event) return
    if (event.type === 'tool_use') {
      const tool = typeof event.data.tool === 'string' ? event.data.tool.trim() : ''
      if (!tool) return
      const parsed = parseChatMcpToolName(tool, { knownServerIds })
      if (!parsed) return
      const id = typeof event.data.id === 'string' ? event.data.id.trim() : ''
      const key = id || `${parsed.serverId}:${parsed.toolName}:${collector.size + 1}`
      collector.set(key, {
        id: key,
        tool,
        serverId: parsed.serverId,
        toolName: parsed.toolName,
        inputSummary: summarizeArtifactValue(event.data.input),
      })
      return
    }
    if (event.type !== 'tool_result') return
    const tool = typeof event.data.tool === 'string' ? event.data.tool.trim() : ''
    const parsed = parseChatMcpToolName(tool, { knownServerIds })
    if (!parsed) return
    const id = typeof event.data.id === 'string' ? event.data.id.trim() : ''
    const key = id || `${parsed.serverId}:${parsed.toolName}:${collector.size + 1}`
    const current = collector.get(key) ?? {
      id: key,
      tool,
      serverId: parsed.serverId,
      toolName: parsed.toolName,
    }
    collector.set(key, {
      ...current,
      resultSummary: summarizeArtifactValue(event.data.content),
      isError: Boolean(event.data.isError),
    })
  }

  private async resolveConversationThreadId(
    session: InteractiveAssistantSessionState,
  ): Promise<string | null> {
    if (!this.deps.conversationLedgerStore || !session.conversationLedgerWorkspacePath) return null
    const paths = this.deps.requireSidecarPaths()
    const openThreads = await this.deps.conversationLedgerStore.listOpen(
      paths,
      session.conversationLedgerWorkspacePath,
    )
    const matched = openThreads.find((thread) => thread.activeSessionId === session.id)
    return matched?.threadId ?? null
  }

  private async persistMcpToolArtifacts(
    session: InteractiveAssistantSessionState,
    artifacts: McpToolArtifactItem[],
  ): Promise<void> {
    if (artifacts.length === 0) return
    const threadId = await this.resolveConversationThreadId(session)
    if (!threadId) return
    const db = await getSidecarSqlite(this.deps.requireSidecarPaths())
    const payload = {
      kind: 'mcp-tool-summary',
      sessionId: session.id,
      provider: session.provider,
      capturedAt: new Date().toISOString(),
      tools: artifacts.map((artifact) => ({
        serverId: artifact.serverId,
        toolName: artifact.toolName,
        inputSummary: artifact.inputSummary,
        resultSummary: artifact.resultSummary,
        isError: artifact.isError ?? false,
      })),
    }
    upsertConversationArtifact(db, {
      artifactId: `art_mcp_${threadId}_${session.id}_${randomUUID()}`,
      threadId,
      artifactRef: session.id,
      kind: 'summary',
      priority: 'high',
      payloadJson: JSON.stringify(payload),
    })
  }

  private hydrateFromSnapshot(snapshot: ComposerAssistSessionSnapshot): void {
    this.clearActiveInMemory()
    if (snapshot.mode === 'interactive-assistant') {
      const session: InteractiveAssistantSessionState = {
        id: snapshot.sessionId,
        mode: 'interactive-assistant',
        workflow: snapshot.workflow,
        provider: snapshot.provider,
        model: snapshot.model,
        effort: snapshot.effort,
        seedBody: snapshot.seedBody,
        orbitSnapshot: snapshot.orbitSnapshot,
        readyToFinalize: snapshot.readyToFinalize,
      }
      this.sessions.set(session.id, session)
      this.activeSessionId = session.id
      return
    }

    const session: PlanningOnlySessionState = {
      id: snapshot.sessionId,
      mode: 'planning-only',
      workflow: snapshot.workflow,
      provider: snapshot.provider,
      model: snapshot.model,
      effort: snapshot.effort,
      seedBody: snapshot.seedBody,
      messages: snapshot.messages.map((message) => ({ ...message })),
      turns: snapshot.turns.map((turn) => ({ ...turn })),
      assistantTurnCount: snapshot.assistantTurnCount,
      readyToFinalize: snapshot.readyToFinalize,
    }
    this.sessions.set(session.id, session)
    this.activeSessionId = session.id
  }

  private interactiveAssistantTurnCount(snapshot: OrbitInteractiveSnapshot): number {
    return snapshot.messages.filter((message) => message.role === 'assistant').length
  }

  private interactiveAtMaxTurns(snapshot: OrbitInteractiveSnapshot): boolean {
    return this.interactiveAssistantTurnCount(snapshot) >= COMPOSER_ASSISTANT_MAX_TURNS
  }

  private async clearLedgerActiveSession(session: InteractiveAssistantSessionState): Promise<void> {
    if (!this.deps.conversationLedgerWriter || !session.conversationLedgerWorkspacePath) return
    await this.deps.conversationLedgerWriter.clearActiveSession(
      session.id,
      session.conversationLedgerWorkspacePath,
    )
  }

  private async clearInteractiveSession(session: InteractiveAssistantSessionState): Promise<void> {
    this.sessions.delete(session.id)
    if (this.activeSessionId === session.id) {
      this.activeSessionId = null
    }
    await this.clearPersistedSnapshot()
  }

  private attachUserReply(session: PlanningOnlySessionState, reply: string): void {
    const last = session.turns[session.turns.length - 1]
    if (last && !last.userReply) {
      last.userReply = reply
      return
    }
    session.turns.push({
      question: 'Continue refining this task instruction?',
      recommendedAnswer: reply,
      userReply: reply,
    })
  }

  private toTurnFromInteractive(
    session: InteractiveAssistantSessionState,
    result: { kind: string; assistantMessage?: string },
    options?: { compactionSummary?: ComposerAssistantTurn['compactionSummary'] },
  ): ComposerAssistantTurn {
    const assistantMessage =
      result.kind === 'assistant_message' ? (result.assistantMessage ?? '') : ''
    const assistantTurnCount = this.interactiveAssistantTurnCount(session.orbitSnapshot)
    const atMaxTurns = this.interactiveAtMaxTurns(session.orbitSnapshot)
    return {
      sessionId: session.id,
      question:
        atMaxTurns && !assistantMessage.trim()
          ? 'Ready to finalize this task instruction?'
          : assistantMessage,
      recommendedAnswer: atMaxTurns ? 'Yes, generate the final instruction' : '',
      assistantMessage,
      turnIndex: assistantTurnCount,
      readyToFinalize: session.readyToFinalize || atMaxTurns,
      ...(options?.compactionSummary ? { compactionSummary: options.compactionSummary } : {}),
    }
  }

  private async askNext(session: PlanningOnlySessionState): Promise<ComposerAssistantTurn> {
    if (session.assistantTurnCount >= COMPOSER_ASSISTANT_MAX_TURNS) {
      session.readyToFinalize = true
      await this.persistSession(session)
      return this.toTurnFromState(session, {
        question: 'Ready to finalize this task instruction?',
        recommendedAnswer: 'Yes, generate the final instruction',
      })
    }

    const engineConfig = withEffortOverride(
      await this.deps.loadEffectiveEngineConfig(),
      session.provider,
      session.effort,
    )
    const turn = await askComposerAssistantTurn({
      provider: session.provider,
      model: session.model,
      cwd: this.deps.requireTaktRepoPath(),
      workflow: session.workflow,
      seedBody: session.seedBody,
      messages: session.messages,
      engineConfig,
    })

    session.assistantTurnCount += 1
    session.messages.push({ role: 'assistant', content: turn.question })
    session.turns.push({
      question: turn.question,
      recommendedAnswer: turn.recommendedAnswer,
    })
    session.readyToFinalize =
      turn.readyToFinalize || session.assistantTurnCount >= COMPOSER_ASSISTANT_MAX_TURNS
    await this.persistSession(session)

    return {
      sessionId: session.id,
      question: turn.question,
      recommendedAnswer: turn.recommendedAnswer,
      turnIndex: session.assistantTurnCount,
      readyToFinalize: session.readyToFinalize,
    }
  }

  private toTurnFromState(
    session: PlanningOnlySessionState,
    override?: Pick<ComposerAssistantTurn, 'question' | 'recommendedAnswer'>,
  ): ComposerAssistantTurn {
    const last = session.turns[session.turns.length - 1]
    return {
      sessionId: session.id,
      question: override?.question ?? last?.question ?? 'Ready to finalize this task instruction?',
      recommendedAnswer:
        override?.recommendedAnswer ??
        last?.recommendedAnswer ??
        'Yes, generate the final instruction',
      turnIndex: session.assistantTurnCount,
      readyToFinalize: session.readyToFinalize,
    }
  }

  private toActiveSessionFromState(session: ComposerSessionState): ComposerAssistActiveSession {
    if (session.mode === 'interactive-assistant') {
      const assistantTurnCount = session.orbitSnapshot.messages.filter(
        (m) => m.role === 'assistant',
      ).length
      return {
        sessionId: session.id,
        mode: 'interactive-assistant',
        workflow: session.workflow,
        seedBody: session.seedBody,
        provider: session.provider,
        model: session.model,
        effort: session.effort,
        sessionPolicy: session.orbitSnapshot.sessionPolicy,
        turns: [],
        conversation: session.orbitSnapshot.messages.map((message) => ({ ...message })),
        readyToFinalize: session.readyToFinalize,
        turnIndex: assistantTurnCount,
      }
    }

    return {
      sessionId: session.id,
      mode: 'planning-only',
      workflow: session.workflow,
      seedBody: session.seedBody,
      provider: session.provider,
      model: session.model,
      effort: session.effort,
      turns: session.turns.map((turn) => ({ ...turn })),
      readyToFinalize: session.readyToFinalize,
      turnIndex: session.assistantTurnCount,
    }
  }

  private toActiveSessionFromSnapshot(
    snapshot: ComposerAssistSessionSnapshot,
  ): ComposerAssistActiveSession {
    if (snapshot.mode === 'interactive-assistant') {
      const assistantTurnCount = snapshot.orbitSnapshot.messages.filter(
        (m) => m.role === 'assistant',
      ).length
      return {
        sessionId: snapshot.sessionId,
        mode: 'interactive-assistant',
        workflow: snapshot.workflow,
        seedBody: snapshot.seedBody,
        provider: snapshot.provider,
        model: snapshot.model,
        effort: snapshot.effort,
        sessionPolicy: snapshot.orbitSnapshot.sessionPolicy,
        turns: [],
        conversation: snapshot.orbitSnapshot.messages.map((message) => ({ ...message })),
        readyToFinalize: snapshot.readyToFinalize,
        turnIndex: assistantTurnCount,
      }
    }

    return {
      sessionId: snapshot.sessionId,
      mode: 'planning-only',
      workflow: snapshot.workflow,
      seedBody: snapshot.seedBody,
      provider: snapshot.provider,
      model: snapshot.model,
      effort: snapshot.effort,
      turns: snapshot.turns.map((turn) => ({ ...turn })),
      readyToFinalize: snapshot.readyToFinalize,
      turnIndex: snapshot.assistantTurnCount,
    }
  }

  /** MCP configs may contain resolved secrets; never load them from sidecar snapshots. */
  private orbitSnapshotWithoutMcpServers(
    orbitSnapshot: OrbitInteractiveSnapshot,
  ): OrbitInteractiveSnapshot {
    const { mcpServers: _mcpServers, ...persistableOrbitSnapshot } =
      orbitSnapshot as OrbitInteractiveSnapshotWithMcp
    return persistableOrbitSnapshot
  }

  private toSnapshot(session: ComposerSessionState): ComposerAssistSessionSnapshot {
    if (session.mode === 'interactive-assistant') {
      return {
        sessionId: session.id,
        mode: 'interactive-assistant',
        workflow: session.workflow,
        provider: session.provider,
        model: session.model,
        ...(session.effort ? { effort: session.effort } : {}),
        seedBody: session.seedBody,
        orbitSnapshot: this.orbitSnapshotWithoutMcpServers(session.orbitSnapshot),
        readyToFinalize: session.readyToFinalize,
        updatedAt: new Date().toISOString(),
      }
    }

    return {
      sessionId: session.id,
      mode: 'planning-only',
      workflow: session.workflow,
      provider: session.provider,
      model: session.model,
      ...(session.effort ? { effort: session.effort } : {}),
      seedBody: session.seedBody,
      messages: session.messages.map((message) => ({ ...message })),
      turns: session.turns.map((turn) => ({ ...turn })),
      assistantTurnCount: session.assistantTurnCount,
      readyToFinalize: session.readyToFinalize,
      updatedAt: new Date().toISOString(),
    }
  }

  private async persistSession(session: ComposerSessionState): Promise<void> {
    await this.deps.sessionStore.save(this.deps.requireSidecarPaths(), this.toSnapshot(session))
  }

  private async loadPersistedSnapshot(): Promise<ComposerAssistSessionSnapshot | null> {
    const snapshot = await this.deps.sessionStore.load(this.deps.requireSidecarPaths())
    if (!snapshot || snapshot.mode !== 'interactive-assistant') return snapshot
    return {
      ...snapshot,
      orbitSnapshot: this.orbitSnapshotWithoutMcpServers(snapshot.orbitSnapshot),
    }
  }

  private async clearPersistedSnapshot(): Promise<void> {
    await this.deps.sessionStore.clear(this.deps.requireSidecarPaths())
  }

  private metricOutcomeFromError(error: unknown): ComposerAssistMetricOutcome {
    if (error instanceof ComposerLlmTimeoutError) return 'timeout'
    return 'error'
  }

  private async recordMetric(
    phase: ComposerAssistMetricPhase,
    outcome: ComposerAssistMetricOutcome,
  ): Promise<void> {
    try {
      await this.deps.metricsStore.record(this.deps.requireSidecarPaths(), phase, outcome)
    } catch {
      // Metrics must not block assist flows.
    }
  }
}
