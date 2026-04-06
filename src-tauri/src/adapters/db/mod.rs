pub mod metric_store;

/// SQLite adapter implementing the EventStore port.
///
/// Schema SQL and pragma constants are defined here as pure data.
/// The SqliteEventStore struct owns the connection and implements EventStore.

use rusqlite::Connection;

use crate::domain::{Event, EventType, Session};
use crate::ports::EventStore;

/// SQL pragma to enable write-ahead logging for concurrent access.
const PRAGMA_WAL: &str = "PRAGMA journal_mode=WAL";

/// SQL pragma to set synchronous mode to NORMAL for performance.
const PRAGMA_SYNCHRONOUS: &str = "PRAGMA synchronous=NORMAL";

/// SQL to create the sessions table.
const CREATE_SESSIONS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        event_count INTEGER NOT NULL DEFAULT 0
    )
";

/// SQL to create the events table.
const CREATE_EVENTS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'unknown'
    )
";

/// SQL migration: add provider column to events table created before v0.2.
/// ALTER TABLE with IF NOT EXISTS is not supported in SQLite, so we check
/// the column list first via a conditional INSERT into a temp migration tracker.
const MIGRATE_ADD_PROVIDER_COLUMN: &str = "
    ALTER TABLE events ADD COLUMN provider TEXT NOT NULL DEFAULT 'unknown'
";

/// SQL to create index on events.session_id for session lookups.
const CREATE_INDEX_EVENTS_SESSION_ID: &str =
    "CREATE INDEX IF NOT EXISTS idx_events_session_id ON events (session_id)";

/// SQL to create index on events.received_at for chronological queries.
const CREATE_INDEX_EVENTS_RECEIVED_AT: &str =
    "CREATE INDEX IF NOT EXISTS idx_events_received_at ON events (received_at)";

/// Composite index for the correlated subquery in get_sessions:
/// SELECT MAX(e.received_at) FROM events e WHERE e.session_id = s.id
/// Without this, SQLite scans all events per session.
const CREATE_INDEX_EVENTS_SESSION_RECEIVED: &str =
    "CREATE INDEX IF NOT EXISTS idx_events_session_received ON events (session_id, received_at)";

/// Resolve the database path for the application.
///
/// Uses the platform data directory (e.g., ~/.local/share/norbert on Linux,
/// %APPDATA%/norbert on Windows).
pub fn resolve_database_path() -> Result<std::path::PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or("Could not determine data directory")?;
    let app_dir = data_dir.join("norbert");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    Ok(app_dir.join("norbert.db"))
}

/// SQLite-backed implementation of the EventStore port.
pub struct SqliteEventStore {
    connection: Connection,
}

impl SqliteEventStore {
    /// Initialize a new SqliteEventStore with the given connection.
    ///
    /// Sets WAL journal mode and NORMAL synchronous pragma,
    /// then creates tables and indexes if they do not exist.
    pub fn new(connection: Connection) -> Result<Self, String> {
        Self::initialize_schema(&connection)?;
        Ok(SqliteEventStore { connection })
    }

    /// Check whether a column exists in a table.
    fn column_exists(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
        let mut stmt = connection
            .prepare(&format!("PRAGMA table_info({})", table))
            .map_err(|e| format!("Failed to query table info: {}", e))?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read table info: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect columns: {}", e))?;
        Ok(columns.iter().any(|c| c == column))
    }

    /// Apply pragmas and create schema on the connection.
    fn initialize_schema(connection: &Connection) -> Result<(), String> {
        connection
            .execute_batch(PRAGMA_WAL)
            .map_err(|e| format!("Failed to set WAL mode: {}", e))?;
        connection
            .execute_batch(PRAGMA_SYNCHRONOUS)
            .map_err(|e| format!("Failed to set synchronous mode: {}", e))?;
        connection
            .execute_batch(CREATE_SESSIONS_TABLE)
            .map_err(|e| format!("Failed to create sessions table: {}", e))?;
        connection
            .execute_batch(CREATE_EVENTS_TABLE)
            .map_err(|e| format!("Failed to create events table: {}", e))?;
        // Migrate: add provider column if missing (pre-v0.2 databases)
        if !Self::column_exists(connection, "events", "provider")? {
            connection
                .execute_batch(MIGRATE_ADD_PROVIDER_COLUMN)
                .map_err(|e| format!("Failed to migrate events table: {}", e))?;
        }
        connection
            .execute_batch(CREATE_INDEX_EVENTS_SESSION_ID)
            .map_err(|e| format!("Failed to create session_id index: {}", e))?;
        connection
            .execute_batch(CREATE_INDEX_EVENTS_RECEIVED_AT)
            .map_err(|e| format!("Failed to create received_at index: {}", e))?;
        connection
            .execute_batch(CREATE_INDEX_EVENTS_SESSION_RECEIVED)
            .map_err(|e| format!("Failed to create composite session+received index: {}", e))?;
        Ok(())
    }
}

/// Map a SQLite row to a Session domain type.
///
/// Expects columns in order: id, started_at, ended_at, event_count, last_event_at.
fn map_row_to_session(row: &rusqlite::Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        started_at: row.get(1)?,
        ended_at: row.get(2)?,
        event_count: row.get(3)?,
        last_event_at: row.get(4)?,
    })
}

impl SqliteEventStore {
    /// Query the stored event_type for a given session_id.
    ///
    /// Test helper: returns the event_type string as stored in SQLite
    /// for the first event matching the given session_id.
    pub fn get_stored_event_type(&self, session_id: &str) -> Result<String, String> {
        self.connection
            .query_row(
                "SELECT event_type FROM events WHERE session_id = ?1 LIMIT 1",
                rusqlite::params![session_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to query event type: {}", e))
    }
}

impl EventStore for SqliteEventStore {
    fn write_event(&self, event: &Event) -> Result<(), String> {
        // Wrap all mutations in a transaction for atomicity (D3)
        self.connection
            .execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        let result = (|| -> Result<(), String> {
            // Upsert session: create if not exists, increment event_count.
            // Clear ended_at on any new event — Claude Code reuses session IDs
            // after sending SessionEnd, so a session can "reopen".
            self.connection
                .execute(
                    "INSERT INTO sessions (id, started_at, ended_at, event_count)
                     VALUES (?1, ?2, NULL, 1)
                     ON CONFLICT(id) DO UPDATE SET event_count = event_count + 1, ended_at = NULL",
                    rusqlite::params![event.session_id, event.received_at],
                )
                .map_err(|e| format!("Failed to upsert session: {}", e))?;

            // Set ended_at when a Stop event finalizes the session
            if event.event_type == EventType::SessionEnd {
                self.connection
                    .execute(
                        "UPDATE sessions SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL",
                        rusqlite::params![event.received_at, event.session_id],
                    )
                    .map_err(|e| format!("Failed to set session ended_at: {}", e))?;
            }

            // Insert the event with provider
            let payload_str = event.payload.to_string();
            self.connection
                .execute(
                    "INSERT INTO events (session_id, event_type, payload, received_at, provider)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        event.session_id,
                        event.event_type.to_string(),
                        payload_str,
                        event.received_at,
                        event.provider,
                    ],
                )
                .map_err(|e| format!("Failed to insert event: {}", e))?;

            Ok(())
        })();

        match result {
            Ok(()) => {
                self.connection
                    .execute_batch("COMMIT")
                    .map_err(|e| format!("Failed to commit transaction: {}", e))?;
                Ok(())
            }
            Err(e) => {
                let _ = self.connection.execute_batch("ROLLBACK");
                Err(e)
            }
        }
    }

    fn get_sessions(&self) -> Result<Vec<Session>, String> {
        let mut stmt = self
            .connection
            .prepare("SELECT s.id, s.started_at, s.ended_at, s.event_count, (SELECT MAX(e.received_at) FROM events e WHERE e.session_id = s.id) as last_event_at FROM sessions s ORDER BY s.started_at DESC")
            .map_err(|e| format!("Failed to prepare sessions query: {}", e))?;

        let sessions = stmt
            .query_map([], map_row_to_session)
            .map_err(|e| format!("Failed to query sessions: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read session row: {}", e))?;

        Ok(sessions)
    }

    fn get_session_count(&self) -> Result<u32, String> {
        let count: u32 = self
            .connection
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count sessions: {}", e))?;
        Ok(count)
    }

    fn get_event_count(&self) -> Result<u32, String> {
        let count: u32 = self
            .connection
            .query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count events: {}", e))?;
        Ok(count)
    }

    fn get_events_for_session(&self, session_id: &str) -> Result<Vec<Event>, String> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT session_id, event_type, payload, received_at, provider FROM events WHERE session_id = ?1 ORDER BY received_at ASC",
            )
            .map_err(|e| format!("Failed to prepare session events query: {}", e))?;

        let events = stmt
            .query_map(rusqlite::params![session_id], |row| {
                let session_id: String = row.get(0)?;
                let event_type_str: String = row.get(1)?;
                let payload_str: String = row.get(2)?;
                let received_at: String = row.get(3)?;
                let provider: String = row.get(4)?;

                let event_type: EventType =
                    serde_json::from_str(&format!("\"{}\"", event_type_str))
                        .map_err(|e| {
                            rusqlite::Error::FromSqlConversionFailure(
                                1,
                                rusqlite::types::Type::Text,
                                Box::new(e),
                            )
                        })?;

                let payload: serde_json::Value =
                    serde_json::from_str(&payload_str).unwrap_or(serde_json::json!({}));

                Ok(Event {
                    session_id,
                    event_type,
                    payload,
                    received_at,
                    provider,
                })
            })
            .map_err(|e| format!("Failed to query session events: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read event row: {}", e))?;

        Ok(events)
    }

    fn get_latest_session(&self) -> Result<Option<Session>, String> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT s.id, s.started_at, s.ended_at, s.event_count, (SELECT MAX(e.received_at) FROM events e WHERE e.session_id = s.id) as last_event_at FROM sessions s ORDER BY s.started_at DESC LIMIT 1",
            )
            .map_err(|e| format!("Failed to prepare latest session query: {}", e))?;

        let mut rows = stmt
            .query_map([], map_row_to_session)
            .map_err(|e| format!("Failed to query latest session: {}", e))?;

        match rows.next() {
            Some(Ok(session)) => Ok(Some(session)),
            Some(Err(e)) => Err(format!("Failed to read latest session: {}", e)),
            None => Ok(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Helper: create an in-memory SqliteEventStore for testing.
    fn create_test_store() -> SqliteEventStore {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        SqliteEventStore::new(conn).expect("Failed to initialize schema")
    }

    /// Helper: create a test Event with given session_id and event_type.
    fn test_event(session_id: &str, event_type: EventType) -> Event {
        Event {
            session_id: session_id.to_string(),
            event_type,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        }
    }

    // --- Schema and pragma tests (acceptance criteria) ---

    #[test]
    fn database_uses_wal_journal_mode() {
        let store = create_test_store();
        let mode: String = store
            .connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        // In-memory databases report "memory" for journal_mode,
        // but the pragma was executed. For file-based DBs it would be "wal".
        // We verify the pragma was accepted without error in create_test_store.
        assert!(
            mode == "wal" || mode == "memory",
            "Expected WAL or memory mode, got: {}",
            mode
        );
    }

    #[test]
    fn database_uses_normal_synchronous_mode() {
        let store = create_test_store();
        let sync_mode: i32 = store
            .connection
            .query_row("PRAGMA synchronous", [], |row| row.get(0))
            .unwrap();
        // synchronous=NORMAL is value 1
        assert_eq!(sync_mode, 1, "Expected synchronous=NORMAL (1), got: {}", sync_mode);
    }

    #[test]
    fn sessions_table_exists_with_correct_columns() {
        let store = create_test_store();
        let columns: Vec<String> = store
            .connection
            .prepare("PRAGMA table_info(sessions)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(columns.contains(&"id".to_string()), "Missing column: id");
        assert!(columns.contains(&"started_at".to_string()), "Missing column: started_at");
        assert!(columns.contains(&"ended_at".to_string()), "Missing column: ended_at");
        assert!(columns.contains(&"event_count".to_string()), "Missing column: event_count");
    }

    #[test]
    fn events_table_exists_with_correct_columns() {
        let store = create_test_store();
        let columns: Vec<String> = store
            .connection
            .prepare("PRAGMA table_info(events)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(columns.contains(&"id".to_string()), "Missing column: id");
        assert!(columns.contains(&"session_id".to_string()), "Missing column: session_id");
        assert!(columns.contains(&"event_type".to_string()), "Missing column: event_type");
        assert!(columns.contains(&"payload".to_string()), "Missing column: payload");
        assert!(columns.contains(&"received_at".to_string()), "Missing column: received_at");
        assert!(columns.contains(&"provider".to_string()), "Missing column: provider");
    }

    #[test]
    fn events_session_id_index_exists() {
        let store = create_test_store();
        let index_exists: bool = store
            .connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_events_session_id'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap()
            > 0;
        assert!(index_exists, "Index idx_events_session_id should exist");
    }

    #[test]
    fn events_received_at_index_exists() {
        let store = create_test_store();
        let index_exists: bool = store
            .connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_events_received_at'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap()
            > 0;
        assert!(index_exists, "Index idx_events_received_at should exist");
    }

    // --- EventStore trait behavior tests ---

    #[test]
    fn write_event_creates_session_and_stores_event() {
        let store = create_test_store();
        let event = test_event("sess-1", EventType::ToolCallStart);

        store.write_event(&event).unwrap();

        let sessions = store.get_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "sess-1");
        assert_eq!(sessions[0].event_count, 1);

        let count = store.get_event_count().unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn write_event_increments_session_event_count() {
        let store = create_test_store();
        let event1 = test_event("sess-1", EventType::ToolCallStart);
        let event2 = test_event("sess-1", EventType::ToolCallEnd);

        store.write_event(&event1).unwrap();
        store.write_event(&event2).unwrap();

        let sessions = store.get_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].event_count, 2);

        let count = store.get_event_count().unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn empty_store_returns_no_data() {
        let store = create_test_store();
        assert!(store.get_sessions().unwrap().is_empty());
        assert_eq!(store.get_event_count().unwrap(), 0);
        assert!(store.get_latest_session().unwrap().is_none());
    }

    #[test]
    fn get_latest_session_returns_most_recent() {
        let store = create_test_store();

        let early_event = Event {
            session_id: "sess-early".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        let late_event = Event {
            session_id: "sess-late".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };

        store.write_event(&early_event).unwrap();
        store.write_event(&late_event).unwrap();

        let latest = store.get_latest_session().unwrap().unwrap();
        assert_eq!(latest.id, "sess-late");
    }

    #[test]
    fn write_event_sets_ended_at_on_session_end_event() {
        let store = create_test_store();

        // First, create the session with a SessionStart event
        let start_event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        store.write_event(&start_event).unwrap();

        // Session should not have ended_at yet
        let session = store.get_latest_session().unwrap().unwrap();
        assert!(session.ended_at.is_none(), "Session should not have ended_at before SessionEnd event");

        // Now send a SessionEnd event
        let end_event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::SessionEnd,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:08:12Z".to_string(),
            provider: "claude_code".to_string(),
        };
        store.write_event(&end_event).unwrap();

        // Session should now have ended_at set
        let session = store.get_latest_session().unwrap().unwrap();
        assert_eq!(
            session.ended_at,
            Some("2026-03-08T10:08:12Z".to_string()),
            "SessionEnd event should set ended_at on the session"
        );
    }

    #[test]
    fn write_event_sets_started_at_from_session_start_event() {
        let store = create_test_store();

        let start_event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        store.write_event(&start_event).unwrap();

        let session = store.get_latest_session().unwrap().unwrap();
        assert_eq!(session.started_at, "2026-03-08T10:00:00Z");
    }

    #[test]
    fn write_event_stores_correct_event_type() {
        let store = create_test_store();
        let event = test_event("sess-1", EventType::AgentComplete);

        store.write_event(&event).unwrap();

        let stored_type: String = store
            .connection
            .query_row("SELECT event_type FROM events LIMIT 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stored_type, "agent_complete");
    }

    #[test]
    fn write_event_stores_payload_as_json() {
        let store = create_test_store();
        let event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({"tool": "Read", "path": "/tmp/test"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };

        store.write_event(&event).unwrap();

        let stored_payload: String = store
            .connection
            .query_row("SELECT payload FROM events LIMIT 1", [], |row| row.get(0))
            .unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&stored_payload).unwrap();
        assert_eq!(parsed["tool"], "Read");
        assert_eq!(parsed["path"], "/tmp/test");
    }

    // --- get_events_for_session tests ---

    #[test]
    fn get_events_for_session_returns_events_for_matching_session() {
        let store = create_test_store();
        let event1 = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-12T10:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        let event2 = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallEnd,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-12T10:01:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        let event3 = Event {
            session_id: "sess-2".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-12T10:02:00Z".to_string(),
            provider: "claude_code".to_string(),
        };

        store.write_event(&event1).unwrap();
        store.write_event(&event2).unwrap();
        store.write_event(&event3).unwrap();

        let events = store.get_events_for_session("sess-1").unwrap();
        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|e| e.session_id == "sess-1"));
        assert!(events.iter().all(|e| e.provider == "claude_code"), "Provider should roundtrip through storage");
    }

    #[test]
    fn get_events_for_session_returns_events_in_chronological_order() {
        let store = create_test_store();
        let event_late = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallEnd,
            payload: serde_json::json!({}),
            received_at: "2026-03-12T10:05:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        let event_early = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-12T10:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };

        // Write late event first to verify ordering is by received_at, not insertion order
        store.write_event(&event_late).unwrap();
        store.write_event(&event_early).unwrap();

        let events = store.get_events_for_session("sess-1").unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].received_at, "2026-03-12T10:00:00Z");
        assert_eq!(events[1].received_at, "2026-03-12T10:05:00Z");
    }

    #[test]
    fn get_events_for_session_returns_empty_for_nonexistent_session() {
        let store = create_test_store();
        let result = store.get_events_for_session("no-such-session");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn schema_initialization_is_idempotent() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        let store = SqliteEventStore::new(conn).expect("First initialization should succeed");

        // Calling initialize_schema again should not fail
        let result = SqliteEventStore::initialize_schema(&store.connection);
        assert!(result.is_ok(), "Re-initialization should succeed: {:?}", result.err());
    }

    #[test]
    fn migration_adds_provider_column_to_legacy_events_table() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");

        // Simulate a pre-v0.2 database: events table without provider column
        conn.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                event_count INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at TEXT NOT NULL
            );"
        ).expect("Failed to create legacy schema");

        // Insert a legacy event (no provider column)
        conn.execute(
            "INSERT INTO events (session_id, event_type, payload, received_at) VALUES ('s1', 'session_start', '{}', '2026-03-08T10:00:00Z')",
            [],
        ).expect("Failed to insert legacy event");

        // Now initialize with current schema — migration should add provider column
        let store = SqliteEventStore::new(conn).expect("Migration should succeed");

        // New events with provider should work
        let event = test_event("sess-new", EventType::SessionStart);
        store.write_event(&event).expect("Write should succeed after migration");

        // Legacy event should have default provider value
        let legacy_provider: String = store
            .connection
            .query_row(
                "SELECT provider FROM events WHERE session_id = 's1'",
                [],
                |row| row.get(0),
            )
            .expect("Should read legacy event provider");
        assert_eq!(legacy_provider, "unknown");
    }

    // --- Data durability: events persist across connections (Scenario #31) ---

    #[test]
    fn events_persist_across_connections() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("durability_test.db");

        // First connection: write events
        {
            let conn = Connection::open(&db_path).expect("Failed to open database");
            let store = SqliteEventStore::new(conn).expect("Failed to initialize schema");

            for i in 0..20 {
                let event = Event {
                    session_id: "sess-durable".to_string(),
                    event_type: EventType::ToolCallStart,
                    payload: serde_json::json!({"index": i}),
                    received_at: format!("2026-03-08T12:{:02}:00Z", i),
                    provider: "claude_code".to_string(),
                };
                store.write_event(&event).unwrap();
            }

            let count = store.get_event_count().unwrap();
            assert_eq!(count, 20, "All events should be stored before closing connection");
        }
        // First connection dropped here -- simulating app shutdown

        // Second connection: verify events survive
        {
            let conn = Connection::open(&db_path).expect("Failed to reopen database");
            let store = SqliteEventStore::new(conn).expect("Failed to reinitialize schema");

            let count = store.get_event_count().unwrap();
            assert_eq!(count, 20, "Pre-restart events should be visible after relaunch");

            let sessions = store.get_sessions().unwrap();
            assert_eq!(sessions.len(), 1, "Session should survive restart");
            assert_eq!(sessions[0].id, "sess-durable");
            assert_eq!(sessions[0].event_count, 20, "Session event count should reflect all captured events");
        }
    }

    #[test]
    fn new_events_accumulate_after_reconnection() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("accumulate_test.db");

        // First connection: write initial events
        {
            let conn = Connection::open(&db_path).expect("Failed to open database");
            let store = SqliteEventStore::new(conn).expect("Failed to initialize schema");

            let event = test_event("sess-1", EventType::SessionStart);
            store.write_event(&event).unwrap();
        }

        // Second connection: write more events, verify accumulation
        {
            let conn = Connection::open(&db_path).expect("Failed to reopen database");
            let store = SqliteEventStore::new(conn).expect("Failed to reinitialize schema");

            let event = Event {
                session_id: "sess-1".to_string(),
                event_type: EventType::ToolCallStart,
                payload: serde_json::json!({"tool": "Read"}),
                received_at: "2026-03-08T12:01:00Z".to_string(),
                provider: "claude_code".to_string(),
            };
            store.write_event(&event).unwrap();

            let count = store.get_event_count().unwrap();
            assert_eq!(count, 2, "Events from both connections should accumulate");

            let sessions = store.get_sessions().unwrap();
            assert_eq!(sessions[0].event_count, 2, "Session event count should include events from both connections");
        }
    }

    // --- Concurrent access: WAL mode allows separate reader and writer connections (Scenario #34) ---

    #[test]
    fn separate_connections_share_data_via_wal() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("concurrent_test.db");

        // Writer connection (simulates sidecar/hook receiver)
        let writer_conn = Connection::open(&db_path).expect("Failed to open writer connection");
        let writer_store = SqliteEventStore::new(writer_conn).expect("Failed to initialize writer");

        // Reader connection (simulates main window)
        let reader_conn = Connection::open(&db_path).expect("Failed to open reader connection");
        let reader_store = SqliteEventStore::new(reader_conn).expect("Failed to initialize reader");

        // Writer stores an event
        let event = Event {
            session_id: "sess-concurrent".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        writer_store.write_event(&event).unwrap();

        // Reader sees the event immediately (WAL mode provides this)
        let count = reader_store.get_event_count().unwrap();
        assert_eq!(count, 1, "Reader should see data written by writer via WAL mode");

        let sessions = reader_store.get_sessions().unwrap();
        assert_eq!(sessions.len(), 1, "Reader should see session created by writer");
        assert_eq!(sessions[0].id, "sess-concurrent");
    }

    #[test]
    fn file_based_database_uses_wal_journal_mode() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("wal_mode_test.db");

        let conn = Connection::open(&db_path).expect("Failed to open database");
        let store = SqliteEventStore::new(conn).expect("Failed to initialize schema");

        let mode: String = store
            .connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "wal", "File-based database should use WAL journal mode");
    }
}
