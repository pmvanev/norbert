/**
 * @norbert/storage -- Storage port and SQLite adapter.
 *
 * Depends on: @norbert/core (domain types only)
 * Exports: Storage port type definitions, SQLite adapter factory, migration runner.
 */

// Port type definitions (uses only @norbert/core types)
export type { StoragePort, WriteResult, StorageError } from './port.js';

// SQLite adapter factory (the only module importing better-sqlite3)
export { createSqliteAdapter } from './sqlite-adapter.js';

// Migration runner (for direct database management)
export { runMigrations } from './migration-runner.js';
