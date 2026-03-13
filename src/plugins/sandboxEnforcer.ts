/// Sandbox Enforcer — pure functions for SQL namespace validation.
///
/// Enforces that plugin database writes are scoped to plugin_{id}_* tables.
/// Core tables are read-only for plugins. All functions are pure —
/// no IO, no side effects, just validation logic.

// ---------------------------------------------------------------------------
// Result type for sandbox validation
// ---------------------------------------------------------------------------

export type SandboxResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Namespace prefix derivation
// ---------------------------------------------------------------------------

/// Converts a plugin id (e.g. "team-monitor") to its namespace prefix
/// (e.g. "plugin_team_monitor_"). Hyphens become underscores.
export const pluginIdToNamespacePrefix = (pluginId: string): string =>
  `plugin_${pluginId.replace(/-/g, "_")}_`;

// ---------------------------------------------------------------------------
// Table namespace checking
// ---------------------------------------------------------------------------

/// Returns true if the table name belongs to the given plugin's namespace.
export const isPluginNamespacedTable = (
  tableName: string,
  pluginId: string
): boolean => tableName.startsWith(pluginIdToNamespacePrefix(pluginId));

// ---------------------------------------------------------------------------
// SQL target table extraction
// ---------------------------------------------------------------------------

/// Extracts the target table from a write SQL statement.
/// Returns null for read-only queries (SELECT).
/// Handles: INSERT INTO, CREATE TABLE, UPDATE, DELETE FROM, DROP TABLE, ALTER TABLE.
export const extractTargetTable = (sql: string): string | null => {
  const trimmed = sql.trim();

  // Read-only: no table extraction needed
  if (/^SELECT\b/i.test(trimmed)) {
    return null;
  }

  // INSERT INTO <table>
  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+(\S+)/i);
  if (insertMatch) return insertMatch[1];

  // CREATE TABLE [IF NOT EXISTS] <table>
  const createMatch = trimmed.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i
  );
  if (createMatch) return createMatch[1];

  // UPDATE <table>
  const updateMatch = trimmed.match(/^UPDATE\s+(\S+)/i);
  if (updateMatch) return updateMatch[1];

  // DELETE FROM <table>
  const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+(\S+)/i);
  if (deleteMatch) return deleteMatch[1];

  // DROP TABLE [IF EXISTS] <table>
  const dropMatch = trimmed.match(
    /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)/i
  );
  if (dropMatch) return dropMatch[1];

  // ALTER TABLE <table>
  const alterMatch = trimmed.match(/^ALTER\s+TABLE\s+(\S+)/i);
  if (alterMatch) return alterMatch[1];

  return null;
};

// ---------------------------------------------------------------------------
// SQL validation for a plugin
// ---------------------------------------------------------------------------

/// Validates whether a SQL statement is allowed for the given plugin.
/// Read-only queries are always allowed.
/// Write operations must target plugin_{id}_* tables only.
export const validateSqlForPlugin = (
  sql: string,
  pluginId: string
): SandboxResult => {
  const targetTable = extractTargetTable(sql);

  // Read-only: always allowed
  if (targetTable === null) {
    return { ok: true };
  }

  // Write to own namespace: allowed
  if (isPluginNamespacedTable(targetTable, pluginId)) {
    return { ok: true };
  }

  // Write to anything else: rejected
  const prefix = pluginIdToNamespacePrefix(pluginId);
  return {
    ok: false,
    error:
      `Plugin '${pluginId}' cannot write to core table '${targetTable}'. ` +
      `Use your namespaced tables: '${prefix}*'.`,
  };
};
