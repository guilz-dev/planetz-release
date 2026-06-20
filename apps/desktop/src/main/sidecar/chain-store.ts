import { type ChainGroup, chainGroupFileSchema } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  listChainGroupRows,
  replaceAllChainGroups,
} from '../storage/sqlite/repositories/chain-groups-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import { parseSidecarJson } from './sidecar-json-parse.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecords, parseSidecarRecordsStrict } from './sidecar-record-parse.js'

function rowToChainGroup(row: { data_json: string; id?: string }): ChainGroup | null {
  return parseSidecarJson<ChainGroup>(row.data_json, `chain group ${row.id ?? '(unknown)'}`)
}

/** Reads Planetz sidecar chain groups for experimental UI (v0.3). */
export class ChainFileStore {
  async load(paths: SidecarPaths): Promise<ChainGroup[]> {
    const db = await getSidecarSqlite(paths)
    const rows = listChainGroupRows(db)
    return parseSidecarRecords(
      rows.map(rowToChainGroup).filter((chain): chain is ChainGroup => chain !== null),
      chainGroupFileSchema,
      'chain group',
    )
  }

  async save(paths: SidecarPaths, chains: ChainGroup[]): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const validChains = parseSidecarRecordsStrict(chains, chainGroupFileSchema, 'chain group')
    runSidecarTransaction(db, () => {
      replaceAllChainGroups(
        db,
        validChains.map((chain) => ({
          id: chain.id,
          createdAt: chain.createdAt,
          dataJson: JSON.stringify(chain),
        })),
      )
    })
  }
}
