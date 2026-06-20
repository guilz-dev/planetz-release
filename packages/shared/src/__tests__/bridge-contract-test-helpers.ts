import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export type IpcRegistrationKind = 'readonly' | 'mutation_helper' | 'mutation_manual'

export interface IpcRegistrationRow {
  channelKey: string
  registrationKind: IpcRegistrationKind
  schemaName: string | null
  requiresSchema: boolean
  sourceFile: string
}

const IPC_REGISTRATION_CALLS = new Set([
  'registerHandler',
  'registerMutationHandler',
  'registerMutationHandlerNoInput',
])

const IPC_DIR_SKIP_FILES = new Set(['ipc-context.ts', 'ipc-handler-utils.ts', 'register-ipc.ts'])

export function resolveRepoRoot(fromImportMetaUrl: string): string {
  return fileURLToPath(new URL('../../../../', fromImportMetaUrl))
}

export function readBridgeTypesSource(repoRoot: string): string {
  return readFileSync(join(repoRoot, 'packages/shared/src/bridge-types.ts'), 'utf8')
}

export function readIpcSchemasSource(repoRoot: string): string {
  return readFileSync(join(repoRoot, 'packages/shared/src/ipc-schemas.ts'), 'utf8')
}

export function extractOrbitBridgeInvokeMethods(
  source: string,
  fileName = 'bridge-types.ts',
): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const methods: string[] = []
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== 'OrbitBridge') continue
    for (const member of statement.members) {
      if (!ts.isMethodSignature(member) && !ts.isPropertySignature(member)) continue
      const name = member.name
      if (name && ts.isIdentifier(name)) methods.push(name.text)
    }
  }
  return methods
}

function extractIpcChannelKey(expression: ts.Expression): string | null {
  if (!ts.isPropertyAccessExpression(expression)) return null
  if (!ts.isIdentifier(expression.expression) || expression.expression.text !== 'IPC_CHANNELS') {
    return null
  }
  return expression.name.text
}

function handlerParamCount(handlerArg: ts.Expression | undefined): number {
  if (!handlerArg) return 0
  if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
    return handlerArg.parameters.length
  }
  return 0
}

function findParseIpcInputSchemaInNode(root: ts.Node): string | null {
  let schema: string | null = null
  function visit(node: ts.Node): void {
    if (schema) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'parseIpcInput'
    ) {
      const schemaArg = node.arguments[0]
      if (schemaArg && ts.isIdentifier(schemaArg)) schema = schemaArg.text
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return schema
}

function containsBroadcastMutation(root: ts.Node): boolean {
  let found = false
  function visit(node: ts.Node): void {
    if (found) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'broadcastMutation'
    ) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function parseRegistrationCall(
  callName: string,
  node: ts.CallExpression,
  sourceFileName: string,
): IpcRegistrationRow | null {
  const channelArg = node.arguments[1]
  if (!channelArg) return null
  const channelKey = extractIpcChannelKey(channelArg)
  if (!channelKey) return null

  let schemaName: string | null = null
  let requiresSchema = false
  const handlerArg = node.arguments[2]

  if (callName === 'registerMutationHandler') {
    requiresSchema = true
    const schemaArg = node.arguments[2]
    if (schemaArg && ts.isIdentifier(schemaArg)) schemaName = schemaArg.text
  } else if (callName === 'registerHandler') {
    requiresSchema = handlerParamCount(handlerArg) >= 2
    if (requiresSchema && handlerArg) {
      schemaName = findParseIpcInputSchemaInNode(handlerArg)
    }
  }

  const registrationKind: IpcRegistrationKind =
    callName === 'registerMutationHandler' || callName === 'registerMutationHandlerNoInput'
      ? 'mutation_helper'
      : handlerArg && containsBroadcastMutation(handlerArg)
        ? 'mutation_manual'
        : 'readonly'

  return {
    channelKey,
    registrationKind,
    schemaName,
    requiresSchema,
    sourceFile: sourceFileName,
  }
}

function extractRegistrationsFromSource(
  source: string,
  sourceFileName: string,
): IpcRegistrationRow[] {
  const sourceFile = ts.createSourceFile(
    sourceFileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const rows: IpcRegistrationRow[] = []

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callName = node.expression.text
      if (IPC_REGISTRATION_CALLS.has(callName)) {
        const row = parseRegistrationCall(callName, node, sourceFileName)
        if (row) rows.push(row)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return rows
}

function listIpcSourceFiles(repoRoot: string): string[] {
  const ipcDir = join(repoRoot, 'apps/desktop/src/main/ipc')
  return readdirSync(ipcDir)
    .filter((name) => name.endsWith('.ts') && !IPC_DIR_SKIP_FILES.has(name))
    .sort()
}

export function collectIpcRegistrations(repoRoot: string): IpcRegistrationRow[] {
  const rows: IpcRegistrationRow[] = []
  for (const fileName of listIpcSourceFiles(repoRoot)) {
    const source = readFileSync(join(repoRoot, 'apps/desktop/src/main/ipc', fileName), 'utf8')
    rows.push(...extractRegistrationsFromSource(source, fileName))
  }
  return rows
}

export function collectExportedSchemaNames(ipcSchemasSource: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    'ipc-schemas.ts',
    ipcSchemasSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const names = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const isExported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (!isExported) continue
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text)
      }
      continue
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add(element.name.text)
        }
      }
    }
  }
  return names
}

export function assertNoDuplicateChannelRegistrations(rows: IpcRegistrationRow[]): void {
  const seen = new Map<string, string>()
  for (const row of rows) {
    const existing = seen.get(row.channelKey)
    if (existing) {
      throw new Error(
        `duplicate IPC registration for ${row.channelKey} in ${existing} and ${row.sourceFile}`,
      )
    }
    seen.set(row.channelKey, row.sourceFile)
  }
}
