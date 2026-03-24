/// SQLite adapter implementing the MetricStore port.
///
/// Schema SQL constants are defined here as pure data.
/// The SqliteMetricStore struct owns the connection and implements MetricStore.

use rusqlite::Connection;

use crate::domain::{AccumulatedMetric, SessionMetadata};
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
        created_at TEXT NOT NULL
    )
";

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

/// SQL for first-write-wins session metadata insertion.
const INSERT_SESSION_METADATA: &str = "
    INSERT OR IGNORE INTO session_metadata (session_id, terminal_type, service_version, os_type, host_arch, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
";

/// SQL to query session metadata by session_id.
const SELECT_SESSION_METADATA: &str = "
    SELECT session_id, terminal_type, service_version, os_type, host_arch
    FROM session_metadata
    WHERE session_id = ?1
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
        Ok(())
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
                })
            },
        );

        match result {
            Ok(metadata) => Ok(Some(metadata)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to query session metadata: {}", e)),
        }
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

    // --- Acceptance test: accumulate delta, read back, verify ---

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
    fn write_session_metadata_is_first_write_wins() {
        let store = create_test_store();

        let first = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("vscode".to_string()),
            service_version: Some("1.0.0".to_string()),
            os_type: Some("linux".to_string()),
            host_arch: Some("x86_64".to_string()),
        };
        let second = SessionMetadata {
            session_id: "sess-1".to_string(),
            terminal_type: Some("cursor".to_string()),
            service_version: Some("2.0.0".to_string()),
            os_type: Some("darwin".to_string()),
            host_arch: Some("arm64".to_string()),
        };

        store.write_session_metadata(&first).unwrap();
        store.write_session_metadata(&second).unwrap();

        let result = store.get_session_metadata("sess-1").unwrap().unwrap();
        assert_eq!(result.terminal_type, Some("vscode".to_string()), "First-write should win");
        assert_eq!(result.service_version, Some("1.0.0".to_string()), "First-write should win");
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
    fn metrics_table_has_correct_columns() {
        let store = create_test_store();
        let columns: Vec<String> = store
            .connection
            .prepare("PRAGMA table_info(metrics)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(columns.contains(&"session_id".to_string()));
        assert!(columns.contains(&"metric_name".to_string()));
        assert!(columns.contains(&"attribute_key".to_string()));
        assert!(columns.contains(&"value".to_string()));
        assert!(columns.contains(&"last_updated_at".to_string()));
    }

    #[test]
    fn session_metadata_table_has_correct_columns() {
        let store = create_test_store();
        let columns: Vec<String> = store
            .connection
            .prepare("PRAGMA table_info(session_metadata)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(columns.contains(&"session_id".to_string()));
        assert!(columns.contains(&"terminal_type".to_string()));
        assert!(columns.contains(&"service_version".to_string()));
        assert!(columns.contains(&"os_type".to_string()));
        assert!(columns.contains(&"host_arch".to_string()));
        assert!(columns.contains(&"created_at".to_string()));
    }

    #[test]
    fn metrics_session_id_index_exists() {
        let store = create_test_store();
        let index_exists: bool = store
            .connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_metrics_session_id'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap()
            > 0;
        assert!(index_exists, "Index idx_metrics_session_id should exist");
    }

    #[test]
    fn schema_initialization_is_idempotent() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        let store = SqliteMetricStore::new(conn).expect("First initialization should succeed");

        let result = SqliteMetricStore::initialize_schema(&store.connection);
        assert!(result.is_ok(), "Re-initialization should succeed: {:?}", result.err());
    }
}
