/**
 * Migration runner -- applies pending SQL migrations to SQLite database.
 *
 * Migrations are numbered SQL files in the migrations/ directory.
 * The schema_version table tracks which migrations have been applied.
 * Forward-only (no rollback). Idempotent (safe to run multiple times).
 *
 * This module imports better-sqlite3 types only for the Database parameter type.
 */

import type Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Migration definition
// ---------------------------------------------------------------------------

interface Migration {
  readonly version: number;
  readonly description: string;
  readonly sql: string;
}

// ---------------------------------------------------------------------------
// Schema version table management
// ---------------------------------------------------------------------------

const ensureSchemaVersionTable = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    );
  `);
};

const getCurrentVersion = (db: Database.Database): number => {
  const row = db.prepare(
    'SELECT MAX(version) as max_version FROM schema_version'
  ).get() as { max_version: number | null } | undefined;
  return row?.max_version ?? 0;
};

const recordMigration = (db: Database.Database, version: number, description: string): void => {
  db.prepare(
    'INSERT INTO schema_version (version, description) VALUES (?, ?)'
  ).run(version, description);
};

// ---------------------------------------------------------------------------
// Migration loading
// ---------------------------------------------------------------------------

const loadMigrations = (): readonly Migration[] => {
  // Resolve the migrations directory relative to this module
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = join(currentDir, 'migrations');

  return [
    {
      version: 1,
      description: 'Initial schema: events, sessions, mcp_events, agent_spans',
      sql: readFileSync(join(migrationsDir, '001_initial.sql'), 'utf-8'),
    },
  ];
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply all pending migrations to the database.
 *
 * Idempotent: safe to call multiple times. Each migration runs in a transaction.
 * Returns the number of migrations applied.
 */
export const runMigrations = (db: Database.Database): number => {
  ensureSchemaVersionTable(db);
  const currentVersion = getCurrentVersion(db);
  const allMigrations = loadMigrations();

  const pendingMigrations = allMigrations.filter(
    (migration) => migration.version > currentVersion
  );

  for (const migration of pendingMigrations) {
    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);
      recordMigration(db, migration.version, migration.description);
    });
    applyMigration();
  }

  return pendingMigrations.length;
};
