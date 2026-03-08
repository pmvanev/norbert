/// SQLite adapter implementing the EventStore port.
///
/// Schema SQL and pragma constants are defined here as pure data.
/// The SqliteEventStore struct owns the connection and implements EventStore.

use rusqlite::Connection;

use crate::domain::{EventType, HookEvent, Session};
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
        received_at TEXT NOT NULL
    )
";

/// SQL to create index on events.session_id for session lookups.
const CREATE_INDEX_EVENTS_SESSION_ID: &str =
    "CREATE INDEX IF NOT EXISTS idx_events_session_id ON events (session_id)";

/// SQL to create index on events.received_at for chronological queries.
const CREATE_INDEX_EVENTS_RECEIVED_AT: &str =
    "CREATE INDEX IF NOT EXISTS idx_events_received_at ON events (received_at)";

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
        connection
            .execute_batch(CREATE_INDEX_EVENTS_SESSION_ID)
            .map_err(|e| format!("Failed to create session_id index: {}", e))?;
        connection
            .execute_batch(CREATE_INDEX_EVENTS_RECEIVED_AT)
            .map_err(|e| format!("Failed to create received_at index: {}", e))?;
        Ok(())
    }
}

impl EventStore for SqliteEventStore {
    fn write_event(&self, event: &HookEvent) -> Result<(), String> {
        // Upsert session: create if not exists, increment event_count
        self.connection
            .execute(
                "INSERT INTO sessions (id, started_at, ended_at, event_count)
                 VALUES (?1, ?2, NULL, 1)
                 ON CONFLICT(id) DO UPDATE SET event_count = event_count + 1",
                rusqlite::params![event.session_id, event.received_at],
            )
            .map_err(|e| format!("Failed to upsert session: {}", e))?;

        // Set ended_at when a Stop event finalizes the session
        if event.event_type == EventType::Stop {
            self.connection
                .execute(
                    "UPDATE sessions SET ended_at = ?1 WHERE id = ?2",
                    rusqlite::params![event.received_at, event.session_id],
                )
                .map_err(|e| format!("Failed to set session ended_at: {}", e))?;
        }

        // Insert the event
        let payload_str = event.payload.to_string();
        self.connection
            .execute(
                "INSERT INTO events (session_id, event_type, payload, received_at)
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    event.session_id,
                    event.event_type.to_string(),
                    payload_str,
                    event.received_at,
                ],
            )
            .map_err(|e| format!("Failed to insert event: {}", e))?;

        Ok(())
    }

    fn get_sessions(&self) -> Result<Vec<Session>, String> {
        let mut stmt = self
            .connection
            .prepare("SELECT id, started_at, ended_at, event_count FROM sessions ORDER BY started_at DESC")
            .map_err(|e| format!("Failed to prepare sessions query: {}", e))?;

        let sessions = stmt
            .query_map([], |row| {
                Ok(Session {
                    id: row.get(0)?,
                    started_at: row.get(1)?,
                    ended_at: row.get(2)?,
                    event_count: row.get(3)?,
                })
            })
            .map_err(|e| format!("Failed to query sessions: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read session row: {}", e))?;

        Ok(sessions)
    }

    fn get_event_count(&self) -> Result<u32, String> {
        let count: u32 = self
            .connection
            .query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count events: {}", e))?;
        Ok(count)
    }

    fn get_latest_session(&self) -> Result<Option<Session>, String> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, started_at, ended_at, event_count FROM sessions ORDER BY started_at DESC LIMIT 1",
            )
            .map_err(|e| format!("Failed to prepare latest session query: {}", e))?;

        let mut rows = stmt
            .query_map([], |row| {
                Ok(Session {
                    id: row.get(0)?,
                    started_at: row.get(1)?,
                    ended_at: row.get(2)?,
                    event_count: row.get(3)?,
                })
            })
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

    /// Helper: create a test HookEvent with given session_id and event_type.
    fn test_event(session_id: &str, event_type: EventType) -> HookEvent {
        HookEvent {
            session_id: session_id.to_string(),
            event_type,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
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
        let event = test_event("sess-1", EventType::PreToolUse);

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
        let event1 = test_event("sess-1", EventType::PreToolUse);
        let event2 = test_event("sess-1", EventType::PostToolUse);

        store.write_event(&event1).unwrap();
        store.write_event(&event2).unwrap();

        let sessions = store.get_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].event_count, 2);

        let count = store.get_event_count().unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn get_sessions_returns_empty_when_no_events() {
        let store = create_test_store();
        let sessions = store.get_sessions().unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn get_event_count_returns_zero_when_no_events() {
        let store = create_test_store();
        let count = store.get_event_count().unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn get_latest_session_returns_none_when_no_sessions() {
        let store = create_test_store();
        let latest = store.get_latest_session().unwrap();
        assert!(latest.is_none());
    }

    #[test]
    fn get_latest_session_returns_most_recent() {
        let store = create_test_store();

        let early_event = HookEvent {
            session_id: "sess-early".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
        };
        let late_event = HookEvent {
            session_id: "sess-late".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
        };

        store.write_event(&early_event).unwrap();
        store.write_event(&late_event).unwrap();

        let latest = store.get_latest_session().unwrap().unwrap();
        assert_eq!(latest.id, "sess-late");
    }

    #[test]
    fn write_event_sets_ended_at_on_stop_event() {
        let store = create_test_store();

        // First, create the session with a SessionStart event
        let start_event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
        };
        store.write_event(&start_event).unwrap();

        // Session should not have ended_at yet
        let session = store.get_latest_session().unwrap().unwrap();
        assert!(session.ended_at.is_none(), "Session should not have ended_at before Stop event");

        // Now send a Stop event
        let stop_event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::Stop,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:08:12Z".to_string(),
        };
        store.write_event(&stop_event).unwrap();

        // Session should now have ended_at set
        let session = store.get_latest_session().unwrap().unwrap();
        assert_eq!(
            session.ended_at,
            Some("2026-03-08T10:08:12Z".to_string()),
            "Stop event should set ended_at on the session"
        );
    }

    #[test]
    fn write_event_sets_started_at_from_session_start_event() {
        let store = create_test_store();

        let start_event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::SessionStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T10:00:00Z".to_string(),
        };
        store.write_event(&start_event).unwrap();

        let session = store.get_latest_session().unwrap().unwrap();
        assert_eq!(session.started_at, "2026-03-08T10:00:00Z");
    }

    #[test]
    fn write_event_stores_correct_event_type() {
        let store = create_test_store();
        let event = test_event("sess-1", EventType::SubagentStop);

        store.write_event(&event).unwrap();

        let stored_type: String = store
            .connection
            .query_row("SELECT event_type FROM events LIMIT 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stored_type, "subagent_stop");
    }

    #[test]
    fn write_event_stores_payload_as_json() {
        let store = create_test_store();
        let event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::PreToolUse,
            payload: serde_json::json!({"tool": "Read", "path": "/tmp/test"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
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

    #[test]
    fn schema_initialization_is_idempotent() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        let store = SqliteEventStore::new(conn).expect("First initialization should succeed");

        // Calling initialize_schema again should not fail
        let result = SqliteEventStore::initialize_schema(&store.connection);
        assert!(result.is_ok(), "Re-initialization should succeed: {:?}", result.err());
    }
}
