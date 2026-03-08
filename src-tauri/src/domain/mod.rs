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
    build_status(0, 0)
}

/// Build application status from real session and event counts.
///
/// Pure function: combines domain constants with live data from the EventStore.
pub fn build_status(session_count: u32, event_count: u32) -> AppStatus {
    AppStatus {
        version: VERSION.to_string(),
        status: "Listening".to_string(),
        port: HOOK_PORT,
        session_count,
        event_count,
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

// --- Settings Merge (Pure Core) ---

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

/// Build a single hook entry as a JSON value.
///
/// Each hook entry has type "http", a URL pointing to the local hook receiver,
/// and async set to true for non-blocking delivery.
pub fn build_hook_entry(port: u16, event_name: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "http",
        "url": build_hook_url(port, event_name),
        "async": true
    })
}

/// Build the complete hooks object containing all 6 event types.
///
/// Pure function: returns a JSON object mapping each event type name
/// to an array containing one hook entry.
pub fn build_hooks_object(port: u16) -> serde_json::Value {
    let mut hooks = serde_json::Map::new();
    for event_name in &HOOK_EVENT_NAMES {
        hooks.insert(
            event_name.to_string(),
            serde_json::json!([build_hook_entry(port, event_name)]),
        );
    }
    serde_json::Value::Object(hooks)
}

/// Result of merging hook settings into a configuration.
#[derive(Debug, Clone, PartialEq)]
pub enum MergeOutcome {
    /// Hooks were added or updated in the configuration.
    Merged(serde_json::Value),
    /// Configuration already contains all required hooks -- no changes needed.
    AlreadyMerged,
}

/// Check whether a JSON configuration already contains all Norbert hook entries.
///
/// Pure function: inspects the hooks object for all 6 event types with correct URLs.
pub fn hooks_are_merged(config: &serde_json::Value, port: u16) -> bool {
    let hooks = match config.get("hooks") {
        Some(h) => h,
        None => return false,
    };

    for event_name in &HOOK_EVENT_NAMES {
        let expected_url = build_hook_url(port, event_name);
        let entries = match hooks.get(*event_name) {
            Some(serde_json::Value::Array(arr)) => arr,
            _ => return false,
        };
        let has_norbert_entry = entries.iter().any(|entry| {
            entry.get("url").and_then(|u| u.as_str()) == Some(expected_url.as_str())
        });
        if !has_norbert_entry {
            return false;
        }
    }
    true
}

/// Merge Norbert hook entries into a Claude Code configuration.
///
/// Pure function: takes existing config JSON, returns new config with hooks added.
/// Preserves all existing settings. Adds Norbert hooks without duplicating them.
/// If hooks are already present, returns AlreadyMerged.
pub fn merge_hooks_into_config(
    config: &serde_json::Value,
    port: u16,
) -> MergeOutcome {
    if hooks_are_merged(config, port) {
        return MergeOutcome::AlreadyMerged;
    }

    let mut new_config = config.clone();

    // Ensure the config is an object
    let config_obj = match new_config.as_object_mut() {
        Some(obj) => obj,
        None => return MergeOutcome::Merged(serde_json::json!({"hooks": build_hooks_object(port)})),
    };

    // Get or create the hooks object
    let hooks = config_obj
        .entry("hooks")
        .or_insert_with(|| serde_json::json!({}));

    let hooks_obj = match hooks.as_object_mut() {
        Some(obj) => obj,
        None => {
            // hooks key exists but is not an object -- replace it
            *hooks = build_hooks_object(port);
            return MergeOutcome::Merged(new_config);
        }
    };

    // For each event type, add the Norbert entry if not already present
    for event_name in &HOOK_EVENT_NAMES {
        let expected_url = build_hook_url(port, event_name);
        let entry = build_hook_entry(port, event_name);

        let entries = hooks_obj
            .entry(event_name.to_string())
            .or_insert_with(|| serde_json::json!([]));

        if let Some(arr) = entries.as_array_mut() {
            let already_present = arr.iter().any(|e| {
                e.get("url").and_then(|u| u.as_str()) == Some(expected_url.as_str())
            });
            if !already_present {
                arr.push(entry);
            }
        } else {
            // Entry exists but is not an array -- replace with array containing our entry
            *entries = serde_json::json!([entry]);
        }
    }

    MergeOutcome::Merged(new_config)
}

/// Build a fresh configuration containing only hooks.
///
/// Used when no existing configuration file is found.
pub fn build_hooks_only_config(port: u16) -> serde_json::Value {
    serde_json::json!({
        "hooks": build_hooks_object(port)
    })
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

    // --- Settings Merge Pure Functions ---

    #[test]
    fn hook_event_names_contains_six_entries() {
        assert_eq!(HOOK_EVENT_NAMES.len(), 6);
    }

    #[test]
    fn build_hook_url_combines_port_and_event_name() {
        let url = build_hook_url(3748, "PreToolUse");
        assert_eq!(url, "http://localhost:3748/hooks/PreToolUse");
    }

    #[test]
    fn build_hook_entry_has_type_url_and_async() {
        let entry = build_hook_entry(3748, "PostToolUse");
        assert_eq!(entry["type"], "http");
        assert_eq!(entry["url"], "http://localhost:3748/hooks/PostToolUse");
        assert_eq!(entry["async"], true);
    }

    #[test]
    fn build_hooks_object_contains_all_six_event_types() {
        let hooks = build_hooks_object(3748);
        for name in &HOOK_EVENT_NAMES {
            assert!(
                hooks.get(name).is_some(),
                "Missing hook event type: {}",
                name
            );
            let entries = hooks[name].as_array().unwrap();
            assert_eq!(entries.len(), 1, "Expected 1 entry for {}", name);
        }
    }

    #[test]
    fn hooks_are_merged_returns_false_for_empty_config() {
        let config = serde_json::json!({});
        assert!(!hooks_are_merged(&config, 3748));
    }

    #[test]
    fn hooks_are_merged_returns_false_when_hooks_key_missing() {
        let config = serde_json::json!({"permissions": {}});
        assert!(!hooks_are_merged(&config, 3748));
    }

    #[test]
    fn hooks_are_merged_returns_false_when_partial_hooks() {
        let config = serde_json::json!({
            "hooks": {
                "PreToolUse": [{"type": "http", "url": "http://localhost:3748/hooks/PreToolUse", "async": true}]
            }
        });
        assert!(!hooks_are_merged(&config, 3748));
    }

    #[test]
    fn hooks_are_merged_returns_true_when_all_hooks_present() {
        let config = serde_json::json!({
            "hooks": build_hooks_object(3748)
        });
        assert!(hooks_are_merged(&config, 3748));
    }

    #[test]
    fn merge_hooks_preserves_existing_settings() {
        let config = serde_json::json!({
            "permissions": {"allow": ["Read", "Write"]},
            "mcpServers": {"github": {"command": "mcp-github", "type": "stdio"}}
        });
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                assert_eq!(
                    merged["permissions"],
                    serde_json::json!({"allow": ["Read", "Write"]})
                );
                assert_eq!(
                    merged["mcpServers"]["github"]["command"],
                    "mcp-github"
                );
                assert!(merged.get("hooks").is_some());
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged, got AlreadyMerged"),
        }
    }

    #[test]
    fn merge_hooks_adds_all_six_event_types() {
        let config = serde_json::json!({});
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                let hooks = merged.get("hooks").expect("hooks key should exist");
                for name in &HOOK_EVENT_NAMES {
                    assert!(
                        hooks.get(name).is_some(),
                        "Missing hook for: {}",
                        name
                    );
                }
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged"),
        }
    }

    #[test]
    fn merge_hooks_each_entry_points_to_localhost_on_hook_port() {
        let config = serde_json::json!({});
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                let hooks = &merged["hooks"];
                for name in &HOOK_EVENT_NAMES {
                    let url = hooks[name][0]["url"].as_str().unwrap();
                    assert!(
                        url.contains("localhost"),
                        "URL should contain localhost: {}",
                        url
                    );
                    assert!(
                        url.contains("3748"),
                        "URL should contain port 3748: {}",
                        url
                    );
                }
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged"),
        }
    }

    #[test]
    fn merge_hooks_each_entry_is_async_for_nonblocking_delivery() {
        let config = serde_json::json!({});
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                let hooks = &merged["hooks"];
                for name in &HOOK_EVENT_NAMES {
                    let is_async = hooks[name][0]["async"].as_bool().unwrap();
                    assert!(is_async, "Hook entry for {} should be async", name);
                }
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged"),
        }
    }

    #[test]
    fn merge_hooks_is_idempotent_returns_already_merged() {
        let config = serde_json::json!({});
        let first = merge_hooks_into_config(&config, 3748);
        let merged_config = match first {
            MergeOutcome::Merged(c) => c,
            MergeOutcome::AlreadyMerged => panic!("Expected Merged on first call"),
        };

        let second = merge_hooks_into_config(&merged_config, 3748);
        assert_eq!(second, MergeOutcome::AlreadyMerged);
    }

    #[test]
    fn merge_hooks_does_not_duplicate_existing_norbert_entries() {
        // Config already has one Norbert hook
        let config = serde_json::json!({
            "hooks": {
                "PreToolUse": [{"type": "http", "url": "http://localhost:3748/hooks/PreToolUse", "async": true}]
            }
        });
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                let pre_tool_entries = merged["hooks"]["PreToolUse"].as_array().unwrap();
                assert_eq!(
                    pre_tool_entries.len(),
                    1,
                    "Should not duplicate existing PreToolUse entry"
                );
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged (other events missing)"),
        }
    }

    #[test]
    fn merge_hooks_preserves_existing_third_party_hook_entries() {
        let config = serde_json::json!({
            "hooks": {
                "PreToolUse": [{"type": "http", "url": "http://other-service:9999/hook", "async": false}]
            }
        });
        let result = merge_hooks_into_config(&config, 3748);
        match result {
            MergeOutcome::Merged(merged) => {
                let pre_tool_entries = merged["hooks"]["PreToolUse"].as_array().unwrap();
                assert_eq!(
                    pre_tool_entries.len(),
                    2,
                    "Should have both third-party and Norbert entries"
                );
                // Verify third-party entry is preserved
                let third_party = &pre_tool_entries[0];
                assert_eq!(third_party["url"], "http://other-service:9999/hook");
            }
            MergeOutcome::AlreadyMerged => panic!("Expected Merged"),
        }
    }

    #[test]
    fn build_hooks_only_config_has_hooks_key() {
        let config = build_hooks_only_config(3748);
        assert!(config.get("hooks").is_some());
        let hooks = &config["hooks"];
        for name in &HOOK_EVENT_NAMES {
            assert!(hooks.get(name).is_some(), "Missing: {}", name);
        }
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

    // --- build_status tests ---

    #[test]
    fn build_status_uses_version_and_hook_port() {
        let status = build_status(0, 0);
        assert_eq!(status.version, VERSION);
        assert_eq!(status.port, HOOK_PORT);
        assert_eq!(status.status, "Listening");
    }

    #[test]
    fn build_status_includes_provided_counts() {
        let status = build_status(3, 42);
        assert_eq!(status.session_count, 3);
        assert_eq!(status.event_count, 42);
    }

    #[test]
    fn build_status_with_zero_counts_matches_initial_status() {
        assert_eq!(build_status(0, 0), initial_status());
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
}
