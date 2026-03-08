/// Core domain types and pure functions for Norbert.
///
/// This module contains no IO or framework imports.
/// All functions are pure and testable in isolation.

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
pub fn initial_status() -> AppStatus {
    AppStatus {
        version: VERSION.to_string(),
        status: "Listening".to_string(),
        port: HOOK_PORT,
        session_count: 0,
        event_count: 0,
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

/// Classification of hook events received from Claude Code.
///
/// Each variant corresponds to a specific lifecycle event in a Claude Code session.
/// Serializes to/from snake_case strings for JSON compatibility.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    /// Fired before a tool is invoked.
    PreToolUse,
    /// Fired after a tool invocation completes.
    PostToolUse,
    /// Fired when a subagent stops.
    SubagentStop,
    /// Fired when the session stops.
    Stop,
    /// Fired when a new session begins.
    SessionStart,
    /// Fired when the user submits a prompt.
    UserPromptSubmit,
}

impl fmt::Display for EventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self {
            EventType::PreToolUse => "pre_tool_use",
            EventType::PostToolUse => "post_tool_use",
            EventType::SubagentStop => "subagent_stop",
            EventType::Stop => "stop",
            EventType::SessionStart => "session_start",
            EventType::UserPromptSubmit => "user_prompt_submit",
        };
        write!(f, "{}", label)
    }
}

/// A single hook event received from Claude Code.
///
/// Immutable record capturing what happened, in which session, and when.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HookEvent {
    /// Identifier of the Claude Code session that produced this event.
    pub session_id: String,
    /// Classification of the event.
    pub event_type: EventType,
    /// Raw JSON payload from Claude Code.
    pub payload: serde_json::Value,
    /// ISO 8601 timestamp when the event was received by Norbert.
    pub received_at: String,
}

/// A Claude Code session tracked by Norbert.
///
/// Immutable snapshot of session metadata.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Session {
    /// Unique session identifier from Claude Code.
    pub id: String,
    /// ISO 8601 timestamp when the session started.
    pub started_at: String,
    /// ISO 8601 timestamp when the session ended, if it has ended.
    pub ended_at: Option<String>,
    /// Number of events received in this session.
    pub event_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_tooltip_combines_name_and_version() {
        let result = format_tooltip("Norbert", "0.1.0");
        assert_eq!(result, "Norbert v0.1.0");
    }

    #[test]
    fn format_tooltip_uses_provided_values() {
        let result = format_tooltip("TestApp", "2.3.4");
        assert_eq!(result, "TestApp v2.3.4");
    }

    #[test]
    fn app_name_constant_is_norbert() {
        assert_eq!(APP_NAME, "Norbert");
    }

    #[test]
    fn version_constant_matches_cargo_version() {
        // VERSION is pulled from Cargo.toml via env!("CARGO_PKG_VERSION")
        assert_eq!(VERSION, "0.1.0");
    }

    #[test]
    fn tooltip_for_current_app_matches_expected() {
        let tooltip = format_tooltip(APP_NAME, VERSION);
        assert_eq!(tooltip, "Norbert v0.1.0");
    }

    #[test]
    fn hook_port_is_3748() {
        assert_eq!(HOOK_PORT, 3748);
    }

    #[test]
    fn initial_status_version_matches_cargo_version() {
        let status = initial_status();
        assert_eq!(status.version, VERSION);
    }

    #[test]
    fn initial_status_is_listening() {
        let status = initial_status();
        assert_eq!(status.status, "Listening");
    }

    #[test]
    fn initial_status_uses_hook_port() {
        let status = initial_status();
        assert_eq!(status.port, HOOK_PORT);
    }

    #[test]
    fn initial_status_starts_with_zero_sessions() {
        let status = initial_status();
        assert_eq!(status.session_count, 0);
    }

    #[test]
    fn initial_status_starts_with_zero_events() {
        let status = initial_status();
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

    // --- EventType tests ---

    #[test]
    fn event_type_has_six_variants() {
        let variants = vec![
            EventType::PreToolUse,
            EventType::PostToolUse,
            EventType::SubagentStop,
            EventType::Stop,
            EventType::SessionStart,
            EventType::UserPromptSubmit,
        ];
        assert_eq!(variants.len(), 6);
    }

    #[test]
    fn event_type_serializes_to_snake_case() {
        let json = serde_json::to_string(&EventType::PreToolUse).unwrap();
        assert_eq!(json, "\"pre_tool_use\"");
    }

    #[test]
    fn event_type_deserializes_from_snake_case() {
        let event_type: EventType = serde_json::from_str("\"post_tool_use\"").unwrap();
        assert_eq!(event_type, EventType::PostToolUse);
    }

    #[test]
    fn event_type_display_matches_variant_name() {
        assert_eq!(EventType::PreToolUse.to_string(), "pre_tool_use");
        assert_eq!(EventType::PostToolUse.to_string(), "post_tool_use");
        assert_eq!(EventType::SubagentStop.to_string(), "subagent_stop");
        assert_eq!(EventType::Stop.to_string(), "stop");
        assert_eq!(EventType::SessionStart.to_string(), "session_start");
        assert_eq!(EventType::UserPromptSubmit.to_string(), "user_prompt_submit");
    }

    // --- HookEvent tests ---

    #[test]
    fn hook_event_holds_event_type_session_id_and_payload() {
        let event = HookEvent {
            session_id: "sess-123".to_string(),
            event_type: EventType::PreToolUse,
            payload: serde_json::json!({"tool": "bash"}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
        };
        assert_eq!(event.session_id, "sess-123");
        assert_eq!(event.event_type, EventType::PreToolUse);
        assert_eq!(event.received_at, "2026-03-08T12:00:00Z");
    }

    #[test]
    fn hook_event_serializes_to_json() {
        let event = HookEvent {
            session_id: "sess-1".to_string(),
            event_type: EventType::Stop,
            payload: serde_json::json!({}),
            received_at: "2026-03-08T12:00:00Z".to_string(),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert!(json.get("session_id").is_some());
        assert!(json.get("event_type").is_some());
        assert!(json.get("payload").is_some());
        assert!(json.get("received_at").is_some());
    }

    // --- Session tests ---

    #[test]
    fn session_holds_id_timestamps_and_event_count() {
        let session = Session {
            id: "sess-abc".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 0,
        };
        assert_eq!(session.id, "sess-abc");
        assert_eq!(session.started_at, "2026-03-08T10:00:00Z");
        assert!(session.ended_at.is_none());
        assert_eq!(session.event_count, 0);
    }

    #[test]
    fn session_serializes_to_json() {
        let session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T11:00:00Z".to_string()),
            event_count: 5,
        };
        let json = serde_json::to_value(&session).unwrap();
        assert!(json.get("id").is_some());
        assert!(json.get("started_at").is_some());
        assert!(json.get("ended_at").is_some());
        assert!(json.get("event_count").is_some());
    }
}
