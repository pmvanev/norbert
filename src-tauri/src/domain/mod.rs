/// Core domain types and pure functions for Norbert.
///
/// This module contains no IO or framework imports.
/// All functions are pure and testable in isolation.

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Application name used in UI labels and tooltips.
pub const APP_NAME: &str = "Norbert";

/// Application version, sourced from Cargo.toml at compile time.
/// Single source of truth -- no other module should hardcode the version.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Port the hook receiver listens on.
/// Single source of truth -- frontend reads this via IPC.
pub const HOOK_PORT: u16 = 3748;

/// Application status returned to the frontend via IPC.
///
/// Immutable snapshot of current application state.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AppStatus {
    pub version: String,
    pub status: String,
    pub port: u16,
    pub session_count: u32,
    pub event_count: u32,
}

/// Build the initial status for a freshly launched application.
///
/// Pure function: derives all values from domain constants.
/// Initial state has 0 sessions and 0 events, so status is "No plugin connected".
pub fn initial_status() -> AppStatus {
    AppStatus {
        version: VERSION.to_string(),
        status: "No plugin connected".to_string(),
        port: HOOK_PORT,
        session_count: 0,
        event_count: 0,
    }
}

/// Derive the application status string from the latest session.
///
/// Pure function: returns "Active session" when the latest session has no
/// ended_at timestamp, otherwise returns "Listening".
pub fn derive_status(latest_session: Option<&Session>) -> String {
    match latest_session {
        Some(session) if session.ended_at.is_none() => "Active session".to_string(),
        _ => "Listening".to_string(),
    }
}

/// Derive the connection-level status from session count, event count, and latest session.
///
/// Pure function: returns "No plugin connected" when no sessions and no events
/// have ever been observed. Otherwise delegates to derive_status for session-level
/// status ("Active session" or "Listening").
pub fn derive_connection_status(
    session_count: u32,
    event_count: u32,
    latest_session: Option<&Session>,
) -> String {
    if session_count == 0 && event_count == 0 {
        "No plugin connected".to_string()
    } else {
        derive_status(latest_session)
    }
}

/// Build application status from real session and event counts.
///
/// Pure function: combines domain constants with live data from the EventStore.
pub fn build_status(session_count: u32, event_count: u32) -> AppStatus {
    AppStatus {
        version: VERSION.to_string(),
        status: derive_connection_status(session_count, event_count, None),
        port: HOOK_PORT,
        session_count,
        event_count,
    }
}

/// Build application status with derived status from latest session.
///
/// Pure function: like build_status but derives the status field from session state.
pub fn build_status_with_session(
    session_count: u32,
    event_count: u32,
    latest_session: Option<&Session>,
) -> AppStatus {
    AppStatus {
        version: VERSION.to_string(),
        status: derive_connection_status(session_count, event_count, latest_session),
        port: HOOK_PORT,
        session_count,
        event_count,
    }
}

/// Format the tray tooltip based on active state.
///
/// Pure function: when listening, shows "AppName vVersion".
/// When active, appends status and event count.
pub fn format_active_tooltip(
    app_name: &str,
    version: &str,
    status: &str,
    event_count: u32,
) -> String {
    let base = format!("{} v{}", app_name, version);
    if status == "Listening" {
        base
    } else {
        format!("{} - {} ({} events)", base, status, event_count)
    }
}

/// Action the application should take on a window when the tray icon is clicked.
#[derive(Debug, Clone, PartialEq)]
pub enum WindowAction {
    /// Window is hidden: show it and bring it to focus.
    ShowAndFocus,
    /// Window is visible: hide it.
    Hide,
}

/// Determine the window action based on current visibility.
///
/// Pure function: maps visibility state to the appropriate toggle action.
/// When visible, the window should hide. When hidden, it should show and focus.
pub fn toggle_window_action(is_visible: bool) -> WindowAction {
    if is_visible {
        WindowAction::Hide
    } else {
        WindowAction::ShowAndFocus
    }
}

/// Build the tray icon tooltip string from app name and version.
///
/// Pure function: no side effects, no IO.
pub fn format_tooltip(app_name: &str, version: &str) -> String {
    format!("{} v{}", app_name, version)
}

/// Canonical classification of events across all tool providers.
///
/// Each variant represents a tool-agnostic lifecycle event.
/// Serializes to/from snake_case strings for JSON compatibility.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    /// A new session has started.
    SessionStart,
    /// A session has ended.
    SessionEnd,
    /// A tool invocation is beginning.
    ToolCallStart,
    /// A tool invocation has completed.
    ToolCallEnd,
    /// An agent has completed its work.
    AgentComplete,
    /// The user has submitted a prompt.
    PromptSubmit,
}

impl fmt::Display for EventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self {
            EventType::SessionStart => "session_start",
            EventType::SessionEnd => "session_end",
            EventType::ToolCallStart => "tool_call_start",
            EventType::ToolCallEnd => "tool_call_end",
            EventType::AgentComplete => "agent_complete",
            EventType::PromptSubmit => "prompt_submit",
        };
        write!(f, "{}", label)
    }
}

/// A canonical event received from any tool provider.
///
/// Immutable record capturing what happened, in which session, from which
/// provider, and when. The provider field identifies the source tool
/// (e.g., "claude_code", "cursor", "windsurf").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Event {
    /// Identifier of the session that produced this event.
    pub session_id: String,
    /// Canonical classification of the event.
    pub event_type: EventType,
    /// Raw JSON payload from the provider.
    pub payload: serde_json::Value,
    /// ISO 8601 timestamp when the event was received by Norbert.
    pub received_at: String,
    /// Identifier of the tool provider that produced this event.
    pub provider: String,
}

/// A session tracked by Norbert.
///
/// Immutable snapshot of session metadata.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Session {
    /// Unique session identifier.
    pub id: String,
    /// ISO 8601 timestamp when the session started.
    pub started_at: String,
    /// ISO 8601 timestamp when the session ended, if it has ended.
    pub ended_at: Option<String>,
    /// Number of events received in this session.
    pub event_count: u32,
}

/// Calculate the duration in seconds between two ISO 8601 timestamps.
///
/// Pure function: returns None if either timestamp cannot be parsed.
pub fn calculate_duration_seconds(started_at: &str, ended_at: &str) -> Option<i64> {
    let start = DateTime::parse_from_rfc3339(started_at).ok()?;
    let end = DateTime::parse_from_rfc3339(ended_at).ok()?;
    Some((end - start).num_seconds())
}

/// Build the hook URL for a given event type name.
///
/// Pure function: combines localhost, port, and event name into a URL string.
pub fn build_hook_url(port: u16, event_name: &str) -> String {
    format!("http://localhost:{}/hooks/{}", port, event_name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_tooltip_combines_name_and_version() {
        assert_eq!(format_tooltip("Norbert", "0.1.0"), "Norbert v0.1.0");
        assert_eq!(format_tooltip("TestApp", "2.3.4"), "TestApp v2.3.4");
    }

    #[test]
    fn app_name_constant_is_norbert() {
        assert_eq!(APP_NAME, "Norbert");
    }

    #[test]
    fn version_constant_matches_cargo_version() {
        // VERSION is pulled from Cargo.toml via env!("CARGO_PKG_VERSION")
        assert_eq!(VERSION, "0.4.1");
    }

    #[test]
    fn tooltip_for_current_app_matches_expected() {
        let tooltip = format_tooltip(APP_NAME, VERSION);
        assert_eq!(tooltip, "Norbert v0.4.1");
    }

    #[test]
    fn hook_port_is_3748() {
        assert_eq!(HOOK_PORT, 3748);
    }

    #[test]
    fn initial_status_has_correct_defaults() {
        let status = initial_status();
        assert_eq!(status.version, VERSION);
        assert_eq!(status.status, "No plugin connected");
        assert_eq!(status.port, HOOK_PORT);
        assert_eq!(status.session_count, 0);
        assert_eq!(status.event_count, 0);
    }

    #[test]
    fn toggle_window_action_hides_when_visible() {
        assert_eq!(toggle_window_action(true), WindowAction::Hide);
    }

    #[test]
    fn toggle_window_action_shows_and_focuses_when_hidden() {
        assert_eq!(toggle_window_action(false), WindowAction::ShowAndFocus);
    }

    // --- Canonical EventType tests ---

    #[test]
    fn event_type_has_six_canonical_variants() {
        let variants = vec![
            EventType::SessionStart,
            EventType::SessionEnd,
            EventType::ToolCallStart,
            EventType::ToolCallEnd,
            EventType::AgentComplete,
            EventType::PromptSubmit,
        ];
        assert_eq!(variants.len(), 6);
    }

    #[test]
    fn event_type_serializes_to_snake_case() {
        assert_eq!(
            serde_json::to_string(&EventType::ToolCallStart).unwrap(),
            "\"tool_call_start\""
        );
    }

    #[test]
    fn event_type_deserializes_from_snake_case() {
        let event_type: EventType = serde_json::from_str("\"tool_call_end\"").unwrap();
        assert_eq!(event_type, EventType::ToolCallEnd);
    }

    #[test]
    fn event_type_display_matches_canonical_snake_case() {
        assert_eq!(EventType::SessionStart.to_string(), "session_start");
        assert_eq!(EventType::SessionEnd.to_string(), "session_end");
        assert_eq!(EventType::ToolCallStart.to_string(), "tool_call_start");
        assert_eq!(EventType::ToolCallEnd.to_string(), "tool_call_end");
        assert_eq!(EventType::AgentComplete.to_string(), "agent_complete");
        assert_eq!(EventType::PromptSubmit.to_string(), "prompt_submit");
    }

    #[test]
    fn event_type_variants_are_tool_agnostic() {
        // Verify no Claude Code-specific names exist in canonical variants
        let display_names: Vec<String> = vec![
            EventType::SessionStart,
            EventType::SessionEnd,
            EventType::ToolCallStart,
            EventType::ToolCallEnd,
            EventType::AgentComplete,
            EventType::PromptSubmit,
        ]
        .into_iter()
        .map(|v| v.to_string())
        .collect();

        for name in &display_names {
            assert!(
                !name.contains("hook"),
                "Canonical event type '{}' should not contain tool-specific term 'hook'",
                name
            );
            assert!(
                !name.contains("subagent"),
                "Canonical event type '{}' should not contain tool-specific term 'subagent'",
                name
            );
        }
    }

    // --- Canonical Event tests ---

    #[test]
    fn event_holds_all_fields_and_serializes_correctly() {
        let event = Event {
            session_id: "sess-123".to_string(),
            event_type: EventType::ToolCallStart,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
            provider: "claude_code".to_string(),
        };
        assert_eq!(event.session_id, "sess-123");
        assert_eq!(event.event_type, EventType::ToolCallStart);
        assert_eq!(event.received_at, "2026-03-08T12:00:00Z");
        assert_eq!(event.provider, "claude_code");

        let json = serde_json::to_value(&event).unwrap();
        assert!(json.get("session_id").is_some());
        assert!(json.get("event_type").is_some());
        assert!(json.get("payload").is_some());
        assert!(json.get("received_at").is_some());
        assert!(json.get("provider").is_some());
        assert_eq!(json["provider"], "claude_code");
    }

    // --- Session tests ---

    #[test]
    fn session_holds_all_fields_and_serializes_correctly() {
        let session = Session {
            id: "sess-abc".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T11:00:00Z".to_string()),
            event_count: 5,
        };
        assert_eq!(session.id, "sess-abc");
        assert_eq!(session.started_at, "2026-03-08T10:00:00Z");
        assert_eq!(session.ended_at, Some("2026-03-08T11:00:00Z".to_string()));
        assert_eq!(session.event_count, 5);

        let json = serde_json::to_value(&session).unwrap();
        assert!(json.get("id").is_some());
        assert!(json.get("started_at").is_some());
        assert!(json.get("ended_at").is_some());
        assert!(json.get("event_count").is_some());
    }

    // --- Hook URL tests ---

    #[test]
    fn build_hook_url_combines_port_and_event_name() {
        let url = build_hook_url(3748, "PreToolUse");
        assert_eq!(url, "http://localhost:3748/hooks/PreToolUse");
    }

    // --- calculate_duration_seconds tests ---

    #[test]
    fn calculate_duration_seconds_returns_difference_in_seconds() {
        let started = "2026-03-08T10:00:00Z";
        let ended = "2026-03-08T10:08:12Z";
        assert_eq!(calculate_duration_seconds(started, ended), Some(492));
    }

    #[test]
    fn calculate_duration_seconds_returns_zero_for_same_timestamps() {
        let timestamp = "2026-03-08T10:00:00Z";
        assert_eq!(calculate_duration_seconds(timestamp, timestamp), Some(0));
    }

    #[test]
    fn calculate_duration_seconds_returns_none_for_invalid_timestamps() {
        assert_eq!(calculate_duration_seconds("not-a-date", "2026-03-08T10:00:00Z"), None);
        assert_eq!(calculate_duration_seconds("2026-03-08T10:00:00Z", "not-a-date"), None);
    }

    #[test]
    fn calculate_duration_seconds_handles_hour_boundary() {
        let started = "2026-03-08T09:30:00Z";
        let ended = "2026-03-08T10:30:00Z";
        assert_eq!(calculate_duration_seconds(started, ended), Some(3600));
    }

    // --- build_status tests ---

    #[test]
    fn build_status_uses_version_and_hook_port() {
        let status = build_status(0, 0);
        assert_eq!(status.version, VERSION);
        assert_eq!(status.port, HOOK_PORT);
        assert_eq!(status.status, "No plugin connected");
    }

    #[test]
    fn build_status_includes_provided_counts() {
        let status = build_status(3, 42);
        assert_eq!(status.session_count, 3);
        assert_eq!(status.event_count, 42);
        assert_eq!(status.status, "Listening");
    }

    #[test]
    fn build_status_with_zero_counts_matches_initial_status() {
        assert_eq!(build_status(0, 0), initial_status());
    }

    // --- derive_status tests ---

    #[test]
    fn derive_status_returns_listening_or_active_based_on_session_state() {
        assert_eq!(derive_status(None), "Listening");

        let ended_session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T10:08:12Z".to_string()),
            event_count: 30,
        };
        assert_eq!(derive_status(Some(&ended_session)), "Listening");

        let active_session = Session {
            id: "sess-2".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        assert_eq!(derive_status(Some(&active_session)), "Active session");
    }

    // --- build_status_with_session tests ---

    #[test]
    fn build_status_with_session_derives_correct_status() {
        // Active session
        let active = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        let status = build_status_with_session(1, 5, Some(&active));
        assert_eq!(status.status, "Active session");
        assert_eq!(status.session_count, 1);
        assert_eq!(status.event_count, 5);

        // No plugin connected when zero counts
        assert_eq!(build_status_with_session(0, 0, None).status, "No plugin connected");

        // Listening when sessions exist but none active
        let ended = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T10:30:00Z".to_string()),
            event_count: 30,
        };
        assert_eq!(build_status_with_session(1, 30, Some(&ended)).status, "Listening");
    }

    // --- derive_connection_status tests ---

    #[test]
    fn derive_connection_status_maps_counts_and_session_state_to_status() {
        assert_eq!(derive_connection_status(0, 0, None), "No plugin connected");
        assert_eq!(derive_connection_status(1, 10, None), "Listening");
        assert_ne!(derive_connection_status(0, 1, None), "No plugin connected");

        let active_session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        assert_eq!(
            derive_connection_status(1, 5, Some(&active_session)),
            "Active session"
        );
    }

    // --- format_active_tooltip tests ---

    #[test]
    fn format_active_tooltip_shows_base_when_listening() {
        let result = format_active_tooltip("Norbert", "0.1.0", "Listening", 0);
        assert_eq!(result, "Norbert v0.1.0");
    }

    #[test]
    fn format_active_tooltip_includes_status_and_events_when_active() {
        let result = format_active_tooltip("Norbert", "0.1.0", "Active session", 15);
        assert_eq!(result, "Norbert v0.1.0 - Active session (15 events)");
    }

}
