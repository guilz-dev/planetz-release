import schemaSql from './schema-v1.sql?raw'

/** Bump when {@link runSchemaMigrations} adds incompatible DDL steps. */
export const SQLITE_SCHEMA_VERSION = 19

export const SCHEMA_V1_SQL = schemaSql
