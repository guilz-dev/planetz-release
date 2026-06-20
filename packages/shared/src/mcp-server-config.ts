import { z } from 'zod'

/** Matches orbit `McpStdioServerConfig`. */
export const mcpStdioServerConfigSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().trim().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export type McpStdioServerConfig = z.infer<typeof mcpStdioServerConfigSchema>

/** Matches orbit `McpSseServerConfig`. */
export const mcpSseServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().trim().url(),
  headers: z.record(z.string(), z.string()).optional(),
})

export type McpSseServerConfig = z.infer<typeof mcpSseServerConfigSchema>

/** Matches orbit `McpHttpServerConfig`. */
export const mcpHttpServerConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string().trim().url(),
  headers: z.record(z.string(), z.string()).optional(),
})

export type McpHttpServerConfig = z.infer<typeof mcpHttpServerConfigSchema>

export const mcpServerConfigSchema = z.union([
  mcpStdioServerConfigSchema,
  mcpSseServerConfigSchema,
  mcpHttpServerConfigSchema,
])

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>

/** Orbit headless `mcpServers` payload: record key = server id. */
export const mcpServersFileSchema = z.record(z.string().trim().min(1), mcpServerConfigSchema)

export type McpServersFile = z.infer<typeof mcpServersFileSchema>

export const mcpPolicyServerEntrySchema = z.object({
  enabled: z.boolean().default(true),
  allowedTools: z.array(z.string().trim().min(1)).optional(),
  requireConsent: z.boolean().optional(),
})

export type McpPolicyServerEntry = z.infer<typeof mcpPolicyServerEntrySchema>

export const mcpPolicyFileSchema = z.object({
  servers: z.record(z.string().trim().min(1), mcpPolicyServerEntrySchema).default({}),
})

export type McpPolicyFile = z.infer<typeof mcpPolicyFileSchema>

export const chatMcpPendingConsentResultSchema = z.object({
  serverIds: z.array(z.string().trim().min(1)),
})

export type ChatMcpPendingConsentResult = z.infer<typeof chatMcpPendingConsentResultSchema>

export const chatMcpGrantConsentInputSchema = z.object({
  serverId: z.string().trim().min(1),
})

export type ChatMcpGrantConsentInput = z.infer<typeof chatMcpGrantConsentInputSchema>

export const chatMcpTransportSchema = z.enum(['stdio', 'sse', 'http'])
export type ChatMcpTransport = z.infer<typeof chatMcpTransportSchema>

export const chatMcpSecretStorageSchema = z.enum(['secure', 'fallback'])
export type ChatMcpSecretStorage = z.infer<typeof chatMcpSecretStorageSchema>

export const chatMcpServerSummarySchema = z.object({
  serverId: z.string().trim().min(1),
  transport: chatMcpTransportSchema,
  enabled: z.boolean(),
  requiresConsent: z.boolean(),
  consentGranted: z.boolean(),
  allowedTools: z.array(z.string().trim().min(1)),
  secretRefs: z.array(z.string().trim().min(1)),
  unresolvedSecretRefs: z.array(z.string().trim().min(1)),
})
export type ChatMcpServerSummary = z.infer<typeof chatMcpServerSummarySchema>

export const chatMcpServersOverviewResultSchema = z.object({
  secureStoreAvailable: z.boolean(),
  servers: z.array(chatMcpServerSummarySchema),
})
export type ChatMcpServersOverviewResult = z.infer<typeof chatMcpServersOverviewResultSchema>

export const chatMcpSetSecretInputSchema = z.object({
  secretName: z.string().trim().min(1),
  secretValue: z.string().trim().min(1),
})
export type ChatMcpSetSecretInput = z.infer<typeof chatMcpSetSecretInputSchema>

export const chatMcpSetSecretResultSchema = z.object({
  storage: chatMcpSecretStorageSchema,
})
export type ChatMcpSetSecretResult = z.infer<typeof chatMcpSetSecretResultSchema>
