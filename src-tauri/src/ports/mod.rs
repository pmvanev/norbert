/// Port traits for Norbert.
///
/// Ports define the abstract boundaries between the domain and the outside world.
/// Each port is a trait with pure function signatures.
/// Adapter implementations live in separate modules -- not here.

use crate::domain::{Event, Session};

/// Storage abstraction for events and sessions.
///
/// Driven port: the domain tells the adapter what to store.
/// Implementations may use SQLite, in-memory storage, or any other backend.
pub trait EventStore {
    /// Persist a canonical event.
    fn write_event(&self, event: &Event) -> Result<(), String>;

    /// Retrieve all sessions, most recent first.
    fn get_sessions(&self) -> Result<Vec<Session>, String>;

    /// Return total number of stored events across all sessions.
    fn get_event_count(&self) -> Result<u32, String>;

    /// Return the most recently started session, if any.
    fn get_latest_session(&self) -> Result<Option<Session>, String>;
}

/// Normalization contract for tool-specific event providers.
///
/// Driving port: each tool provider adapter implements this trait
/// to normalize its native event format into canonical Event types.
pub trait EventProvider {
    /// The provider identifier (e.g., "claude_code", "cursor").
    fn provider_name(&self) -> &str;

    /// Normalize a raw provider-specific event into a canonical Event.
    ///
    /// Returns None if the raw input cannot be mapped to a canonical event type.
    fn normalize(
        &self,
        raw_event_type: &str,
        session_id: String,
        payload: serde_json::Value,
        received_at: String,
    ) -> Option<Event>;

    /// Return the list of provider-specific event type names this provider handles.
    fn supported_event_names(&self) -> &[&str];
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Event, EventType, Session};

    /// In-memory stub implementing EventStore for testing.
    struct StubEventStore {
        events: Vec<Event>,
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
        fn write_event(&self, _event: &Event) -> Result<(), String> {
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

    /// Stub implementing EventProvider for testing.
    struct StubEventProvider;

    impl EventProvider for StubEventProvider {
        fn provider_name(&self) -> &str {
            "test_provider"
        }

        fn normalize(
            &self,
            raw_event_type: &str,
            session_id: String,
            payload: serde_json::Value,
            received_at: String,
        ) -> Option<Event> {
            let event_type = match raw_event_type {
                "start" => EventType::SessionStart,
                "end" => EventType::SessionEnd,
                _ => return None,
            };
            Some(Event {
                session_id,
                event_type,
                payload,
                received_at,
                provider: self.provider_name().to_string(),
            })
        }

        fn supported_event_names(&self) -> &[&str] {
            &["start", "end"]
        }
    }

    // --- EventStore stub tests ---

    #[test]
    fn event_store_stub_write_event_succeeds() {
        let store = StubEventStore::new();
        let event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
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

    // --- EventProvider trait tests ---

    #[test]
    fn event_provider_returns_provider_name() {
        let provider = StubEventProvider;
        assert_eq!(provider.provider_name(), "test_provider");
    }

    #[test]
    fn event_provider_normalizes_known_event_type() {
        let provider = StubEventProvider;
        let event = provider.normalize(
            "start",
            "sess-1".to_string(),
            serde_json::json!({}),
            "2026-03-12T10:00:00Z".to_string(),
        );
        assert!(event.is_some());
        let event = event.unwrap();
        assert_eq!(event.event_type, EventType::SessionStart);
        assert_eq!(event.provider, "test_provider");
        assert_eq!(event.session_id, "sess-1");
    }

    #[test]
    fn event_provider_returns_none_for_unknown_event_type() {
        let provider = StubEventProvider;
        let event = provider.normalize(
            "unknown",
            "sess-1".to_string(),
            serde_json::json!({}),
            "2026-03-12T10:00:00Z".to_string(),
        );
        assert!(event.is_none());
    }

    #[test]
    fn event_provider_lists_supported_event_names() {
        let provider = StubEventProvider;
        let names = provider.supported_event_names();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"start"));
        assert!(names.contains(&"end"));
    }

    #[test]
    fn event_provider_normalized_event_contains_provider_field() {
        let provider = StubEventProvider;
        let event = provider
            .normalize(
                "end",
                "sess-42".to_string(),
                serde_json::json!({"reason": "done"}),
                "2026-03-12T11:00:00Z".to_string(),
            )
            .unwrap();
        assert_eq!(event.provider, "test_provider");
        assert_eq!(event.event_type, EventType::SessionEnd);
        assert_eq!(event.session_id, "sess-42");
    }
}
