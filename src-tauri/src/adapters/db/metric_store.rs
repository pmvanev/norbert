/// SQLite adapter implementing the MetricStore port.
///
/// Schema SQL constants are defined here as pure data.
/// The SqliteMetricStore struct owns the connection and implements MetricStore.

use rusqlite::Connection;

use crate::domain::{AccumulatedMetric, SessionMetadata, SessionSummary};
use crate::ports::MetricStore;

/// SQL to create the metrics table with compound primary key.
const CREATE_METRICS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS metrics (
        session_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        attribute_key TEXT NOT NULL DEFAULT '',
        value REAL NOT NULL DEFAULT 0.0,
        last_updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, metric_name, attribute_key)
    )
";

/// SQL to create index on metrics.session_id for session lookups.
const CREATE_INDEX_METRICS_SESSION_ID: &str =
    "CREATE INDEX IF NOT EXISTS idx_metrics_session_id ON metrics (session_id)";

/// SQL to create the session_metadata table.
const CREATE_SESSION_METADATA_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        terminal_type TEXT,
        service_version TEXT,
        os_type TEXT,
        host_arch TEXT,
        cwd TEXT,
        created_at TEXT NOT NULL
    )
";

/// SQL migration: add cwd column to existing session_metadata tables.
/// SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so the caller checks
/// for the column first via PRAGMA table_info.
const MIGRATE_ADD_CWD_COLUMN: &str =
    "ALTER TABLE session_metadata ADD COLUMN cwd TEXT";

/// SQL for atomic upsert: accumulate delta onto existing value.
const UPSERT_METRIC: &str = "
    INSERT INTO metrics (session_id, metric_name, attribute_key, value, last_updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT (session_id, metric_name, attribute_key)
    DO UPDATE SET value = value + excluded.value, last_updated_at = excluded.last_updated_at
";

/// SQL to query all metrics for a session.
const SELECT_METRICS_FOR_SESSION: &str = "
    SELECT metric_name, attribute_key, value
    FROM metrics
    WHERE session_id = ?1
    ORDER BY metric_name, attribute_key
";

/// SQL for session metadata insertion with NULL backfill.
///
/// First non-NULL value wins per column: existing non-NULL values are
/// preserved, but NULL columns get filled in by later batches that carry
/// the data. This matters because Claude Code spreads enrichment attributes
/// (terminal.type, service.version, etc.) across different OTLP batches —
/// a strict first-write-wins policy would freeze a session at whatever
/// happened to arrive first.
const INSERT_SESSION_METADATA: &str = "
    INSERT INTO session_metadata (session_id, terminal_type, service_version, os_type, host_arch, cwd, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT (session_id) DO UPDATE SET
        terminal_type = COALESCE(terminal_type, excluded.terminal_type),
        service_version = COALESCE(service_version, excluded.service_version),
        os_type = COALESCE(os_type, excluded.os_type),
        host_arch = COALESCE(host_arch, excluded.host_arch),
        cwd = COALESCE(cwd, excluded.cwd)
";

/// SQL to query session metadata by session_id.
const SELECT_SESSION_METADATA: &str = "
    SELECT session_id, terminal_type, service_version, os_type, host_arch, cwd
    FROM session_metadata
    WHERE session_id = ?1
";

/// SQL to query aggregate cost and token totals per session in one pass.
const SELECT_SESSION_SUMMARIES: &str = "
    SELECT session_id,
           COALESCE(SUM(CASE WHEN metric_name = 'cost.usage' THEN value ELSE 0 END), 0) AS total_cost,
           COALESCE(SUM(CASE WHEN metric_name = 'token.usage' THEN value ELSE 0 END), 0) AS total_tokens
    FROM metrics
    GROUP BY session_id
";

/// SQL to query all session metadata rows.
const SELECT_ALL_SESSION_METADATA: &str = "
    SELECT session_id, terminal_type, service_version, os_type, host_arch, cwd
    FROM session_metadata
    ORDER BY created_at DESC
";

/// SQLite-backed implementation of the MetricStore port.
pub struct SqliteMetricStore {
    connection: Connection,
}

impl SqliteMetricStore {
    /// Initialize a new SqliteMetricStore with the given connection.
    ///
    /// Creates metrics and session_metadata tables if they do not exist.
    pub fn new(connection: Connection) -> Result<Self, String> {
        Self::initialize_schema(&connection)?;
        Ok(SqliteMetricStore { connection })
    }

    /// Create schema on the connection.
    fn initialize_schema(connection: &Connection) -> Result<(), String> {
        connection
            .execute_batch(CREATE_METRICS_TABLE)
            .map_err(|e| format!("Failed to create metrics table: {}", e))?;
        connection
            .execute_batch(CREATE_INDEX_METRICS_SESSION_ID)
            .map_err(|e| format!("Failed to create metrics session_id index: {}", e))?;
        connection
            .execute_batch(CREATE_SESSION_METADATA_TABLE)
            .map_err(|e| format!("Failed to create session_metadata table: {}", e))?;
        // Migrate: add cwd column to pre-existing databases that pre-date this field.
        if !Self::session_metadata_has_column(connection, "cwd")? {
            connection
                .execute_batch(MIGRATE_ADD_CWD_COLUMN)
                .map_err(|e| format!("Failed to migrate session_metadata table: {}", e))?;
        }
        Ok(())
    }

    /// Check whether the session_metadata table already has a given column.
    fn session_metadata_has_column(connection: &Connection, column: &str) -> Result<bool, String> {
        let mut stmt = connection
            .prepare("PRAGMA table_info(session_metadata)")
            .map_err(|e| format!("Failed to query session_metadata table info: {}", e))?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read session_metadata table info: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect session_metadata columns: {}", e))?;
        Ok(columns.iter().any(|c| c == column))
    }
}

impl MetricStore for SqliteMetricStore {
    fn accumulate_delta(
        &self,
        session_id: &str,
        metric_name: &str,
        attribute_key: &str,
        delta: f64,
        timestamp: &str,
    ) -> Result<(), String> {
        self.connection
            .execute(
                UPSERT_METRIC,
                rusqlite::params![session_id, metric_name, attribute_key, delta, timestamp],
            )
            .map_err(|e| format!("Failed to accumulate metric delta: {}", e))?;
        Ok(())
    }

    fn get_metrics_for_session(&self, session_id: &str) -> Result<Vec<AccumulatedMetric>, String> {
        let mut stmt = self
            .connection
            .prepare(SELECT_METRICS_FOR_SESSION)
            .map_err(|e| format!("Failed to prepare metrics query: {}", e))?;

        let metrics = stmt
            .query_map(rusqlite::params![session_id], |row| {
                Ok(AccumulatedMetric {
                    metric_name: row.get(0)?,
                    attribute_key: row.get(1)?,
                    value: row.get(2)?,
                })
            })
            .map_err(|e| format!("Failed to query metrics: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read metric row: {}", e))?;

        Ok(metrics)
    }

    fn write_session_metadata(&self, metadata: &SessionMetadata) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.connection
            .execute(
                INSERT_SESSION_METADATA,
                rusqlite::params![
                    metadata.session_id,
                    metadata.terminal_type,
                    metadata.service_version,
                    metadata.os_type,
                    metadata.host_arch,
                    metadata.cwd,
                    now,
                ],
            )
            .map_err(|e| format!("Failed to write session metadata: {}", e))?;
        Ok(())
    }

    fn get_session_metadata(&self, session_id: &str) -> Result<Option<SessionMetadata>, String> {
        let result = self.connection.query_row(
            SELECT_SESSION_METADATA,
            rusqlite::params![session_id],
            |row| {
                Ok(SessionMetadata {
                    session_id: row.get(0)?,
                    terminal_type: row.get(1)?,
                    service_version: row.get(2)?,
                    os_type: row.get(3)?,
                    host_arch: row.get(4)?,
                    cwd: row.get(5)?,
                })
            },
        );

        match result {
            Ok(metadata) => Ok(Some(metadata)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to query session metadata: {}", e)),
        }
    }

    fn get_all_session_metadata(&self) -> Result<Vec<SessionMetadata>, String> {
        let mut stmt = self
            .connection
            .prepare(SELECT_ALL_SESSION_METADATA)
            .map_err(|e| format!("Failed to prepare all session metadata query: {}", e))?;

        let metadata = stmt
            .query_map([], |row| {
                Ok(SessionMetadata {
                    session_id: row.get(0)?,
                    terminal_type: row.get(1)?,
                    service_version: row.get(2)?,
                    os_type: row.get(3)?,
                    host_arch: row.get(4)?,
                    cwd: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query all session metadata: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read session metadata row: {}", e))?;

        Ok(metadata)
    }

    fn get_all_session_summaries(&self) -> Result<Vec<SessionSummary>, String> {
        let mut stmt = self
            .connection
            .prepare(SELECT_SESSION_SUMMARIES)
            .map_err(|e| format!("Failed to prepare session summaries query: {}", e))?;

        let summaries = stmt
            .query_map([], |row| {
                Ok(SessionSummary {
                    session_id: row.get(0)?,
                    total_cost: row.get(1)?,
                    total_tokens: row.get(2)?,
                })
            })
            .map_err(|e| format!("Failed to query session summaries: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read session summary row: {}", e))?;

        Ok(summaries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Helper: create an in-memory SqliteMetricStore for testing.
    fn create_test_store() -> SqliteMetricStore {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        SqliteMetricStore::new(conn).expect("Failed to initialize schema")
    }

    // --- Acceptance tests ---

    /// Acceptance test for step 03-01: IPC queries for metrics and session metadata.
    ///
    /// Exercises the three query paths that back the IPC commands:
    /// - get_metrics_for_session returns accumulated metrics
    /// - get_session_metadata returns enrichment data for a session
    /// - get_all_session_metadata returns enrichment for all sessions
    /// - Nonexistent session returns empty vec / None
    #[test]
    fn ipc_query_paths_return_correct_data_for_populated_and_empty_sessions() {
        let store = create_test_store();

        // Populate two sessions with metrics and metadata
        store.accumulate_delta("sess-A", "cost.usage", "model=claude-opus-4-6", 0.10, "2026-03-24T10:00:00Z").unwrap();
        store.accumulate_delta("sess-A", "token.usage", "model=claude-opus-4-6,type=input", 500.0, "2026-03-24T10:00:01Z").unwrap();
        store.accumulate_delta("sess-B", "cost.usage", "model=claude-sonnet-4", 0.03, "2026-03-24T10:01:00Z").unwrap();

        store.write_session_metadata(&SessionMetadata {
            session_id: "sess-A".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: Some("1.0.0".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
            cwd: None,
        }).unwrap();
        store.write_session_metadata(&SessionMetadata {
            session_id: "sess-B".to_string(),
            terminal_type: Some("cursor".to_string()),
            service_version: Some("2.0.0".to_string()),
            os_type: None,
            host_arch: None,
            cwd: None,
        }).unwrap();

        // AC: get_metrics_for_session returns accumulated metrics for a session
        let metrics_a = store.get_metrics_for_session("sess-A").unwrap();
        assert_eq!(metrics_a.len(), 2, "sess-A should have 2 metric series");
        let metrics_b = store.get_metrics_for_session("sess-B").unwrap();
        assert_eq!(metrics_b.len(), 1, "sess-B should have 1 metric series");

        // AC: get_session_metadata returns enrichment data for a session
        let meta_a = store.get_session_metadata("sess-A").unwrap();
        assert!(meta_a.is_some(), "sess-A should have metadata");
        assert_eq!(meta_a.unwrap().terminal_type, Some("vscode".to_string()));

        // AC: get_all_session_metadata returns enrichment for all sessions
        let all_meta = store.get_all_session_metadata().unwrap();
        assert_eq!(all_meta.len(), 2, "Should have metadata for both sessions");

        // AC: Nonexistent session returns empty array / null
        let metrics_missing = store.get_metrics_for_session("nonexistent").unwrap();
        assert!(metrics_missing.is_empty(), "Nonexistent session metrics should be empty");
        let meta_missing = store.get_session_metadata("nonexistent").unwrap();
        assert!(meta_missing.is_none(), "Nonexistent session metadata should be None");
    }

    #[test]
    fn accumulate_delta_and_read_back_returns_correct_value() {
        let store = create_test_store();

        store
            .accumulate_delta(
                "sess-1",
                "cost.usage",
                "model=claude-opus-4-6",
                0.05,
                "2026-03-24T10:00:00Z",
            )
            .unwrap();

        let metrics = store.get_metrics_for_session("sess-1").unwrap();
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].metric_name, "cost.usage");
        assert_eq!(metrics[0].attribute_key, "model=claude-opus-4-6");
        assert!((metrics[0].value - 0.05).abs() < f64::EPSILON);
    }

    // --- Unit tests ---

    #[test]
    fn two_deltas_sum_correctly_via_upsert() {
        let store = create_test_store();

        store
            .accumulate_delta(
                "sess-1",
                "token.usage",
                "model=claude-opus-4-6,type=input",
                100.0,
                "2026-03-24T10:00:00Z",
            )
            .unwrap();
        store
            .accumulate_delta(
                "sess-1",
                "token.usage",
                "model=claude-opus-4-6,type=input",
                250.0,
                "2026-03-24T10:01:00Z",
            )
            .unwrap();

        let metrics = store.get_metrics_for_session("sess-1").unwrap();
        assert_eq!(metrics.len(), 1);
        assert!((metrics[0].value - 350.0).abs() < f64::EPSILON);
    }

    #[test]
    fn compound_primary_key_distinguishes_different_attribute_keys() {
        let store = create_test_store();

        store
            .accumulate_delta("sess-1", "token.usage", "model=claude-opus-4-6,type=input", 100.0, "2026-03-24T10:00:00Z")
            .unwrap();
        store
            .accumulate_delta("sess-1", "token.usage", "model=claude-opus-4-6,type=output", 50.0, "2026-03-24T10:00:00Z")
            .unwrap();

        let metrics = store.get_metrics_for_session("sess-1").unwrap();
        assert_eq!(metrics.len(), 2, "Different attribute_keys should be separate rows");
    }

    #[test]
    fn get_metrics_for_session_returns_empty_when_no_data() {
        let store = create_test_store();

        let metrics = store.get_metrics_for_session("nonexistent-session").unwrap();
        assert!(metrics.is_empty());
    }

    #[test]
    fn write_and_read_session_metadata() {
        let store = create_test_store();

        let metadata = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: Some("1.2.3".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
            cwd: None,
        };

        store.write_session_metadata(&metadata).unwrap();

        let result = store.get_session_metadata("sess-1").unwrap().unwrap();
        assert_eq!(result.session_id, "sess-1");
        assert_eq!(result.terminal_type, Some("vscode".to_string()));
        assert_eq!(result.service_version, Some("1.2.3".to_string()));
        assert_eq!(result.os_type, Some("linux".to_string()));
        assert_eq!(result.host_arch, Some("x86_64".to_string()));
    }

    #[test]
    fn get_session_metadata_returns_none_when_no_data() {
        let store = create_test_store();

        let result = store.get_session_metadata("nonexistent-session").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn write_session_metadata_backfills_null_columns_from_later_writes() {
        // Regression: Claude Code splits enrichment attributes across OTLP
        // batches. A session whose first batch lacked terminal.type must be
        // upgradable when a later batch carries it.
        let store = create_test_store();

        let first = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: None,
            service_version: Some("1.0.0".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
            cwd: None,
        };
        let second = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: None,
            os_type: None,
            host_arch: None,
            cwd: None,
        };

        store.write_session_metadata(&first).unwrap();
        store.write_session_metadata(&second).unwrap();

        let result = store.get_session_metadata("sess-1").unwrap().unwrap();
        assert_eq!(result.terminal_type, Some("vscode".to_string()), "NULL should be backfilled");
        assert_eq!(result.service_version, Some("1.0.0".to_string()), "Non-NULL should be preserved");
        assert_eq!(result.os_type, Some("linux".to_string()));
        assert_eq!(result.host_arch, Some("x86_64".to_string()));
    }

    #[test]
    fn write_session_metadata_is_first_non_null_wins_per_column() {
        let store = create_test_store();

        let first = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: Some("1.0.0".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
            cwd: None,
        };
        let second = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("cursor".to_string()),
            service_version: Some("2.0.0".to_string()),
            os_type: Some("darwin".to_string()),
            host_arch: Some("arm64".to_string()),
            cwd: None,
        };

        store.write_session_metadata(&first).unwrap();
        store.write_session_metadata(&second).unwrap();

        let result = store.get_session_metadata("sess-1").unwrap().unwrap();
        assert_eq!(result.terminal_type, Some("vscode".to_string()), "First non-NULL should win");
        assert_eq!(result.service_version, Some("1.0.0".to_string()), "First non-NULL should win");
    }

    #[test]
    fn session_metadata_handles_nullable_fields() {
        let store = create_test_store();

        let metadata = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: None,
            service_version: None,
            os_type: None,
            host_arch: None,
            cwd: None,
        };

        store.write_session_metadata(&metadata).unwrap();

        let result = store.get_session_metadata("sess-1").unwrap().unwrap();
        assert_eq!(result.session_id, "sess-1");
        assert!(result.terminal_type.is_none());
        assert!(result.service_version.is_none());
        assert!(result.os_type.is_none());
        assert!(result.host_arch.is_none());
    }

    #[test]
    fn get_all_session_metadata_returns_empty_when_no_data() {
        let store = create_test_store();

        let result = store.get_all_session_metadata().unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn get_all_session_metadata_returns_all_sessions() {
        let store = create_test_store();

        let meta1 = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: Some("1.0.0".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
            cwd: None,
        };
        let meta2 = SessionMetadata {
            session_id: "sess-2".to_string(),
            terminal_type: Some("cursor".to_string()),
            service_version: Some("2.0.0".to_string()),
            os_type: Some("darwin".to_string()),
            host_arch: Some("arm64".to_string()),
            cwd: None,
        };

        store.write_session_metadata(&meta1).unwrap();
        store.write_session_metadata(&meta2).unwrap();

        let result = store.get_all_session_metadata().unwrap();
        assert_eq!(result.len(), 2);

        let session_ids: Vec<&str> = result.iter().map(|m| m.session_id.as_str()).collect();
        assert!(session_ids.contains(&"sess-1"));
        assert!(session_ids.contains(&"sess-2"));
    }

    #[test]
    fn schema_initialization_is_idempotent() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        let store = SqliteMetricStore::new(conn).expect("First initialization should succeed");

        let result = SqliteMetricStore::initialize_schema(&store.connection);
        assert!(result.is_ok(), "Re-initialization should succeed: {:?}", result.err());
    }
}
