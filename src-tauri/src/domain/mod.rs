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

/// Parse a PascalCase event type name from a URL path segment into an EventType.
///
/// Claude Code hook URLs use PascalCase names (e.g., "PreToolUse").
/// Returns None for unrecognized event type names.
pub fn parse_event_type(name: &str) -> Option<EventType> {
    match name {
        "PreToolUse" => Some(EventType::PreToolUse),
        "PostToolUse" => Some(EventType::PostToolUse),
        "SubagentStop" => Some(EventType::SubagentStop),
        "Stop" => Some(EventType::Stop),
        "SessionStart" => Some(EventType::SessionStart),
        "UserPromptSubmit" => Some(EventType::UserPromptSubmit),
        _ => None,
    }
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

/// Calculate the duration in seconds between two ISO 8601 timestamps.
///
/// Pure function: returns None if either timestamp cannot be parsed.
pub fn calculate_duration_seconds(started_at: &str, ended_at: &str) -> Option<i64> {
    let start = DateTime::parse_from_rfc3339(started_at).ok()?;
    let end = DateTime::parse_from_rfc3339(ended_at).ok()?;
    Some((end - start).num_seconds())
}

/// The 6 hook event type names as they appear in Claude Code settings.json.
///
/// These are PascalCase strings matching the Claude Code hook configuration format.
pub const HOOK_EVENT_NAMES: [&str; 6] = [
    "PreToolUse",
    "PostToolUse",
    "SubagentStop",
    "Stop",
    "SessionStart",
    "UserPromptSubmit",
];

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
    fn initial_status_is_no_plugin_connected() {
        let status = initial_status();
        assert_eq!(status.status, "No plugin connected");
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

    // --- Hook constants and URL tests ---

    #[test]
    fn hook_event_names_contains_six_entries() {
        assert_eq!(HOOK_EVENT_NAMES.len(), 6);
    }

    #[test]
    fn build_hook_url_combines_port_and_event_name() {
        let url = build_hook_url(3748, "PreToolUse");
        assert_eq!(url, "http://localhost:3748/hooks/PreToolUse");
    }

    // --- parse_event_type tests ---

    #[test]
    fn parse_event_type_recognizes_all_pascal_case_names() {
        assert_eq!(parse_event_type("PreToolUse"), Some(EventType::PreToolUse));
        assert_eq!(parse_event_type("PostToolUse"), Some(EventType::PostToolUse));
        assert_eq!(parse_event_type("SubagentStop"), Some(EventType::SubagentStop));
        assert_eq!(parse_event_type("Stop"), Some(EventType::Stop));
        assert_eq!(parse_event_type("SessionStart"), Some(EventType::SessionStart));
        assert_eq!(parse_event_type("UserPromptSubmit"), Some(EventType::UserPromptSubmit));
    }

    #[test]
    fn parse_event_type_returns_none_for_unknown_name() {
        assert_eq!(parse_event_type("UnknownEvent"), None);
    }

    #[test]
    fn parse_event_type_returns_none_for_snake_case_name() {
        assert_eq!(parse_event_type("pre_tool_use"), None);
    }

    #[test]
    fn parse_event_type_returns_none_for_empty_string() {
        assert_eq!(parse_event_type(""), None);
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
    fn calculate_duration_seconds_returns_none_for_invalid_start() {
        assert_eq!(calculate_duration_seconds("not-a-date", "2026-03-08T10:00:00Z"), None);
    }

    #[test]
    fn calculate_duration_seconds_returns_none_for_invalid_end() {
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
    fn derive_status_returns_listening_when_no_session() {
        assert_eq!(derive_status(None), "Listening");
    }

    #[test]
    fn derive_status_returns_listening_when_session_ended() {
        let session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T10:08:12Z".to_string()),
            event_count: 30,
        };
        assert_eq!(derive_status(Some(&session)), "Listening");
    }

    #[test]
    fn derive_status_returns_active_session_when_session_has_no_ended_at() {
        let session = Session {
            id: "sess-2".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        assert_eq!(derive_status(Some(&session)), "Active session");
    }

    // --- build_status_with_session tests ---

    #[test]
    fn build_status_with_session_derives_active_status() {
        let session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        let status = build_status_with_session(1, 5, Some(&session));
        assert_eq!(status.status, "Active session");
        assert_eq!(status.session_count, 1);
        assert_eq!(status.event_count, 5);
    }

    #[test]
    fn build_status_with_session_derives_no_plugin_when_zero_counts() {
        let status = build_status_with_session(0, 0, None);
        assert_eq!(status.status, "No plugin connected");
    }

    #[test]
    fn build_status_with_session_derives_listening_when_sessions_exist_but_no_active() {
        let session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T10:30:00Z".to_string()),
            event_count: 30,
        };
        let status = build_status_with_session(1, 30, Some(&session));
        assert_eq!(status.status, "Listening");
    }

    // --- derive_connection_status tests ---

    #[test]
    fn derive_connection_status_returns_no_plugin_when_zero_counts() {
        assert_eq!(derive_connection_status(0, 0, None), "No plugin connected");
    }

    #[test]
    fn derive_connection_status_returns_listening_when_events_exist() {
        assert_eq!(derive_connection_status(1, 10, None), "Listening");
    }

    #[test]
    fn derive_connection_status_returns_active_when_session_ongoing() {
        let session = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
        };
        assert_eq!(
            derive_connection_status(1, 5, Some(&session)),
            "Active session"
        );
    }

    #[test]
    fn derive_connection_status_never_returns_no_plugin_once_events_exist() {
        assert_ne!(derive_connection_status(0, 1, None), "No plugin connected");
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

    // --- Event type consistency (Scenario #36) ---

    #[test]
    fn every_hook_event_name_is_parseable_by_parse_event_type() {
        for name in &HOOK_EVENT_NAMES {
            assert!(
                parse_event_type(name).is_some(),
                "HOOK_EVENT_NAMES contains '{}' which parse_event_type does not recognize",
                name
            );
        }
    }

    #[test]
    fn hook_url_port_matches_hook_port_constant() {
        for name in &HOOK_EVENT_NAMES {
            let url = build_hook_url(HOOK_PORT, name);
            assert!(
                url.contains(&HOOK_PORT.to_string()),
                "Hook URL for {} should contain port {}: {}",
                name,
                HOOK_PORT,
                url
            );
        }
    }

    // --- Event type consistency property tests (Scenario #37) ---

    /// All EventType variants as a complete list.
    /// If a new variant is added to EventType, this test must be updated.
    fn all_event_type_variants() -> Vec<EventType> {
        vec![
            EventType::PreToolUse,
            EventType::PostToolUse,
            EventType::SubagentStop,
            EventType::Stop,
            EventType::SessionStart,
            EventType::UserPromptSubmit,
        ]
    }

    #[test]
    fn hook_event_names_and_event_type_variants_have_same_count() {
        assert_eq!(
            HOOK_EVENT_NAMES.len(),
            all_event_type_variants().len(),
            "HOOK_EVENT_NAMES and EventType variants must have the same count"
        );
    }

    #[test]
    fn every_event_type_variant_has_a_corresponding_hook_event_name() {
        let parseable_variants: Vec<EventType> = HOOK_EVENT_NAMES
            .iter()
            .filter_map(|name| parse_event_type(name))
            .collect();

        for variant in all_event_type_variants() {
            assert!(
                parseable_variants.contains(&variant),
                "EventType::{:?} has no corresponding entry in HOOK_EVENT_NAMES",
                variant
            );
        }
    }

    #[test]
    fn hook_event_names_are_unique() {
        let mut seen = std::collections::HashSet::new();
        for name in &HOOK_EVENT_NAMES {
            assert!(
                seen.insert(name),
                "Duplicate entry in HOOK_EVENT_NAMES: {}",
                name
            );
        }
    }

    #[test]
    fn hook_url_event_name_roundtrips_through_parse_event_type() {
        for name in &HOOK_EVENT_NAMES {
            let url = build_hook_url(HOOK_PORT, name);
            let path_segment = url.rsplit('/').next().unwrap();
            let parsed = parse_event_type(path_segment);
            assert!(
                parsed.is_some(),
                "URL path segment '{}' from hook URL should parse to a valid EventType",
                path_segment
            );
        }
    }

    #[test]
    fn no_receiver_route_exists_without_settings_registration() {
        // Every name parseable by parse_event_type must exist in HOOK_EVENT_NAMES
        let all_variants = all_event_type_variants();
        for variant in &all_variants {
            // Find which HOOK_EVENT_NAME parses to this variant
            let matching_name = HOOK_EVENT_NAMES
                .iter()
                .find(|name| parse_event_type(name) == Some(variant.clone()));
            assert!(
                matching_name.is_some(),
                "EventType::{:?} is accepted by the receiver but has no registration in HOOK_EVENT_NAMES",
                variant
            );
        }
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    /// Strategy that generates valid PascalCase event type names from HOOK_EVENT_NAMES.
    fn valid_event_name() -> impl Strategy<Value = String> {
        prop::sample::select(HOOK_EVENT_NAMES.to_vec()).prop_map(|s| s.to_string())
    }

    proptest! {
        /// Property: every valid event name from HOOK_EVENT_NAMES parses successfully
        /// and the parsed type's Display output is a valid snake_case string.
        #[test]
        fn parse_event_type_succeeds_for_all_hook_event_names(name in valid_event_name()) {
            let parsed = parse_event_type(&name);
            prop_assert!(parsed.is_some(), "parse_event_type should succeed for '{}'", name);
            let display = parsed.unwrap().to_string();
            prop_assert!(!display.is_empty(), "Display output should not be empty");
            prop_assert!(
                display.chars().all(|c| c.is_ascii_lowercase() || c == '_'),
                "Display output '{}' should be snake_case",
                display
            );
        }

        /// Property: build_hook_url for any valid event name always contains the event name
        /// and the port, forming a valid route that parse_event_type can handle.
        #[test]
        fn hook_url_contains_parseable_event_name(name in valid_event_name(), port in 1024..65535u16) {
            let url = build_hook_url(port, &name);
            let path_segment = url.rsplit('/').next().unwrap();
            prop_assert_eq!(path_segment, name.as_str());
            prop_assert!(parse_event_type(path_segment).is_some());
        }

    }
}
