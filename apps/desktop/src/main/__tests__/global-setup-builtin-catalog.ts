import { ensureBuiltinWorkflowCatalogLoaded } from '../takt/builtin-workflow-registry.js'

/** Warm the bundled workflow catalog once so parallel main tests avoid repeated full scans. */
export default async function globalSetup(): Promise<void> {
  await ensureBuiltinWorkflowCatalogLoaded()
}
