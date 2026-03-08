/// Port traits for Norbert.
///
/// Ports define the abstract boundaries between the domain and the outside world.
/// Each port is a trait with pure function signatures.
/// Adapter implementations live in separate modules -- not here.

use crate::domain::{HookEvent, Session};

/// Storage abstraction for hook events and sessions.
///
/// Driven port: the domain tells the adapter what to store.
/// Implementations may use SQLite, in-memory storage, or any other backend.
pub trait EventStore {
    /// Persist a hook event.
    fn write_event(&self, event: &HookEvent) -> Result<(), String>;

    /// Retrieve all sessions, most recent first.
    fn get_sessions(&self) -> Result<Vec<Session>, String>;

    /// Return total number of stored events across all sessions.
    fn get_event_count(&self) -> Result<u32, String>;

    /// Return the most recently started session, if any.
    fn get_latest_session(&self) -> Result<Option<Session>, String>;
}

/// Settings abstraction for Claude Code configuration management.
///
/// Driven port: the domain tells the adapter how to manage settings files.
pub trait SettingsManager {
    /// Merge managed settings into the Claude Code configuration.
    fn merge_settings(&self) -> Result<(), String>;

    /// Check whether managed settings are currently merged.
    fn is_merged(&self) -> Result<bool, String>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{EventType, HookEvent, Session};

    /// In-memory stub implementing EventStore for testing.
    struct StubEventStore {
        events: Vec<HookEvent>,
        sessions: Vec<Session>,
    }

    impl StubEventStore {
        fn new() -> Self {
            StubEventStore {
                events: Vec::new(),
                sessions: Vec::new(),
            }
        }

        fn with_sessions(sessions: Vec<Session>) -> Self {
            StubEventStore {
                events: Vec::new(),
                sessions,
            }
        }
    }

    impl EventStore for StubEventStore {
        fn write_event(&self, _event: &HookEvent) -> Result<(), String> {
            Ok(())
        }

        fn get_sessions(&self) -> Result<Vec<Session>, String> {
            Ok(self.sessions.clone())
        }

        fn get_event_count(&self) -> Result<u32, String> {
            Ok(self.events.len() as u32)
        }

        fn get_latest_session(&self) -> Result<Option<Session>, String> {
            Ok(self.sessions.first().cloned())
        }
    }

    /// Stub implementing SettingsManager for testing.
    struct StubSettingsManager {
        merged: bool,
    }

    impl StubSettingsManager {
        fn new(merged: bool) -> Self {
            StubSettingsManager { merged }
        }
    }

    impl SettingsManager for StubSettingsManager {
        fn merge_settings(&self) -> Result<(), String> {
            Ok(())
        }

        fn is_merged(&self) -> Result<bool, String> {
            Ok(self.merged)
        }
    }

    #[test]
    fn event_store_stub_write_event_succeeds() {
        let store = StubEventStore::new();
        let event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::PreToolUse,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
        };
        assert!(store.write_event(&event).is_ok());
    }

    #[test]
    fn event_store_stub_returns_empty_sessions() {
        let store = StubEventStore::new();
        let sessions = store.get_sessions().unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn event_store_stub_returns_provided_sessions() {
        let sessions = vec![Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 3,
        }];
        let store = StubEventStore::with_sessions(sessions);
        let result = store.get_sessions().unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "sess-1");
    }

    #[test]
    fn event_store_stub_returns_zero_event_count() {
        let store = StubEventStore::new();
        assert_eq!(store.get_event_count().unwrap(), 0);
    }

    #[test]
    fn event_store_stub_returns_latest_session() {
        let sessions = vec![Session {
            id: "sess-latest".to_string(),
            started_at: "2026-03-08T12:00:00Z".to_string(),
            ended_at: None,
            event_count: 1,
        }];
        let store = StubEventStore::with_sessions(sessions);
        let latest = store.get_latest_session().unwrap();
        assert!(latest.is_some());
        assert_eq!(latest.unwrap().id, "sess-latest");
    }

    #[test]
    fn settings_manager_stub_merge_succeeds() {
        let manager = StubSettingsManager::new(false);
        assert!(manager.merge_settings().is_ok());
    }

    #[test]
    fn settings_manager_stub_reports_not_merged() {
        let manager = StubSettingsManager::new(false);
        assert!(!manager.is_merged().unwrap());
    }

    #[test]
    fn settings_manager_stub_reports_merged() {
        let manager = StubSettingsManager::new(true);
        assert!(manager.is_merged().unwrap());
    }
}
