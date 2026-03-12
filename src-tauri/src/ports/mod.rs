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

    /// Retrieve all events for a given session, ordered chronologically.
    ///
    /// Returns an empty Vec when the session does not exist or has no events.
    fn get_events_for_session(&self, session_id: &str) -> Result<Vec<Event>, String>;
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

        fn get_events_for_session(&self, session_id: &str) -> Result<Vec<Event>, String> {
            Ok(self
                .events
                .iter()
                .filter(|e| e.session_id == session_id)
                .cloned()
                .collect())
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

    // --- EventStore trait contract tests ---

    #[test]
    fn event_store_stub_satisfies_trait_contract() {
        // Empty store: write succeeds, returns empty collections, zero counts
        let store = StubEventStore::new();
        let event = Event {
            session_id: "sess-1".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        assert!(store.write_event(&event).is_ok());
        assert!(store.get_sessions().unwrap().is_empty());
        assert_eq!(store.get_event_count().unwrap(), 0);
        assert!(store.get_latest_session().unwrap().is_none());
        assert!(store.get_events_for_session("no-such-session").unwrap().is_empty());
    }

    #[test]
    fn event_store_stub_returns_configured_data() {
        let sessions = vec![Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 3,
        }];
        let store = StubEventStore::with_sessions(sessions);
        assert_eq!(store.get_sessions().unwrap().len(), 1);
        assert_eq!(store.get_sessions().unwrap()[0].id, "sess-1");
        assert_eq!(store.get_latest_session().unwrap().unwrap().id, "sess-1");

        // Store with events filters by session_id
        let store_with_events = StubEventStore {
            events: vec![
                Event {
                    session_id: "sess-1".to_string(),
                    event_type: EventType::ToolCallStart,
                    payload: serde_json::json!({}),
                    received_at: "2026-03-12T10:00:00Z".to_string(),
                    provider: "claude_code".to_string(),
                },
                Event {
                    session_id: "sess-2".to_string(),
                    event_type: EventType::SessionStart,
                    payload: serde_json::json!({}),
                    received_at: "2026-03-12T10:01:00Z".to_string(),
                    provider: "claude_code".to_string(),
                },
            ],
            sessions: Vec::new(),
        };
        let events = store_with_events.get_events_for_session("sess-1").unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].session_id, "sess-1");
    }

    // --- EventProvider trait contract tests ---

    #[test]
    fn event_provider_stub_satisfies_trait_contract() {
        let provider = StubEventProvider;
        assert_eq!(provider.provider_name(), "test_provider");

        // Known types normalize successfully with correct fields
        let event = provider.normalize(
            "start",
            "sess-1".to_string(),
            serde_json::json!({}),
            "2026-03-12T10:00:00Z".to_string(),
        ).unwrap();
        assert_eq!(event.event_type, EventType::SessionStart);
        assert_eq!(event.provider, "test_provider");
        assert_eq!(event.session_id, "sess-1");

        let event = provider.normalize(
            "end",
            "sess-42".to_string(),
            serde_json::json!({"reason": "done"}),
            "2026-03-12T11:00:00Z".to_string(),
        ).unwrap();
        assert_eq!(event.event_type, EventType::SessionEnd);
        assert_eq!(event.provider, "test_provider");

        // Unknown types return None
        assert!(provider.normalize(
            "unknown",
            "sess-1".to_string(),
            serde_json::json!({}),
            "2026-03-12T10:00:00Z".to_string(),
        ).is_none());

        // Supported names
        let names = provider.supported_event_names();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"start"));
        assert!(names.contains(&"end"));
    }
}
