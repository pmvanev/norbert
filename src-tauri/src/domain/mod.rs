/// Core domain types and pure functions for Norbert.
///
/// This module contains no IO or framework imports.
/// All functions are pure and testable in isolation.
pub mod phosphor_history;

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::fmt;

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

// ---------------------------------------------------------------------------
// Multi-window launch behavior
// ---------------------------------------------------------------------------

/// CLI flag that requests a new window on launch.
///
/// When present in process arguments, a second-instance launch spawns an
/// additional window instead of focusing the existing one.
pub const NEW_WINDOW_FLAG: &str = "--new-window";

/// Default label Tauri assigns to the first webview window.
pub const DEFAULT_WINDOW_LABEL: &str = "main";

/// Interpretation of the command-line arguments passed to a Norbert launch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchIntent {
    /// Standard launch: open the app or focus the existing instance.
    Default,
    /// Explicit request for a new window (e.g. `norbert.exe --new-window`).
    NewWindow,
}

/// Action the application should take in response to a launch or re-launch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchAction {
    /// No Norbert window exists yet -- create the first one.
    SpawnFirst,
    /// A window already exists and the intent is default -- show/focus it.
    FocusExisting,
    /// A window already exists and the user asked for another -- spawn one.
    SpawnAdditional,
}

/// Parse command-line arguments into a launch intent.
///
/// Pure function: looks for `--new-window` anywhere in the arg list.
/// All other arguments are ignored.
pub fn parse_launch_intent(args: &[String]) -> LaunchIntent {
    if args.iter().any(|a| a == NEW_WINDOW_FLAG) {
        LaunchIntent::NewWindow
    } else {
        LaunchIntent::Default
    }
}

/// Decide what the application should do in response to a launch.
///
/// Pure function combining the parsed intent with current window state.
/// Rules:
/// - No existing window: always spawn (first window must exist regardless of intent).
/// - Existing window + Default intent: focus existing (avoids accidental duplicates).
/// - Existing window + NewWindow intent: spawn an additional window.
pub fn decide_launch_action(intent: LaunchIntent, has_existing_window: bool) -> LaunchAction {
    match (intent, has_existing_window) {
        (_, false) => LaunchAction::SpawnFirst,
        (LaunchIntent::Default, true) => LaunchAction::FocusExisting,
        (LaunchIntent::NewWindow, true) => LaunchAction::SpawnAdditional,
    }
}

/// Generate a unique label for a newly spawned window.
///
/// Pure function: returns `"main"` when no windows exist, otherwise returns
/// the lowest-numbered `"window-N"` (N >= 2) not already in use. The default
/// first-window label is always `"main"` to match Tauri's convention.
pub fn next_window_label(existing_labels: &[&str]) -> String {
    if existing_labels.is_empty() {
        return DEFAULT_WINDOW_LABEL.to_string();
    }
    let mut n: u32 = 2;
    loop {
        let candidate = format!("window-{}", n);
        if !existing_labels.iter().any(|l| *l == candidate) {
            return candidate;
        }
        n += 1;
    }
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
    /// An API request has been made (OTel span).
    ApiRequest,
    /// A user prompt has been received (OTel span).
    UserPrompt,
    /// A tool invocation result (OTel span).
    ToolResult,
    /// An API error occurred (OTel span).
    ApiError,
    /// A tool use decision has been made (OTel span).
    ToolDecision,
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
            EventType::ApiRequest => "api_request",
            EventType::UserPrompt => "user_prompt",
            EventType::ToolResult => "tool_result",
            EventType::ApiError => "api_error",
            EventType::ToolDecision => "tool_decision",
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
    /// ISO 8601 timestamp of the most recent event in this session.
    /// Used by the frontend to detect stale sessions that never received
    /// a SessionEnd event.
    pub last_event_at: Option<String>,
}

/// An accumulated metric data point stored in the metrics table.
///
/// Represents the running total for a specific metric series identified
/// by the compound key (session_id, metric_name, attribute_key).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccumulatedMetric {
    /// Metric name (e.g., "cost.usage", "token.usage").
    pub metric_name: String,
    /// Compound key from sorted non-session attributes (e.g., "model=claude-opus-4-6,type=input").
    pub attribute_key: String,
    /// Accumulated total value.
    pub value: f64,
}

/// Session metadata extracted from OTLP resource and standard attributes.
///
/// Populated on first OTLP payload per session. All fields except session_id
/// are optional for graceful degradation when attributes are missing.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// Unique session identifier.
    pub session_id: String,
    /// Terminal type (e.g., "vscode", "cursor", "iTerm.app").
    pub terminal_type: Option<String>,
    /// Claude Code version (from resource attribute service.version).
    pub service_version: Option<String>,
    /// Operating system type (from resource attribute os.type).
    pub os_type: Option<String>,
    /// Host architecture (from resource attribute host.arch).
    pub host_arch: Option<String>,
    /// Working directory the Claude Code session was started from
    /// (from the top-level `cwd` field on hook payloads). Used to render
    /// a meaningful project name in the Sessions view.
    pub cwd: Option<String>,
    /// Git branch name active in the cwd when the session started.
    /// Derived by running `git rev-parse --abbrev-ref HEAD` in the cwd.
    /// None when cwd is not a git repo or git is not available.
    pub git_branch: Option<String>,
}

/// Pre-aggregated cost and token totals for a single session.
///
/// Returned by bulk summary queries so the frontend can populate
/// session table rows without per-session round trips.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    /// Unique session identifier.
    pub session_id: String,
    /// Total accumulated cost (sum of all cost.usage rows).
    pub total_cost: f64,
    /// Total accumulated tokens (sum of all token.usage rows).
    pub total_tokens: f64,
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
    fn version_constant_matches_cargo_version() {
        // VERSION is pulled from Cargo.toml via env!("CARGO_PKG_VERSION")
        assert_eq!(VERSION, "0.4.4");
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

    // --- Multi-window launch behavior tests ---

    #[test]
    fn parse_launch_intent_defaults_when_no_flag_present() {
        let args: Vec<String> = vec!["norbert.exe".into()];
        assert_eq!(parse_launch_intent(&args), LaunchIntent::Default);
    }

    #[test]
    fn parse_launch_intent_detects_new_window_flag() {
        let args: Vec<String> = vec!["norbert.exe".into(), "--new-window".into()];
        assert_eq!(parse_launch_intent(&args), LaunchIntent::NewWindow);
    }

    #[test]
    fn parse_launch_intent_detects_new_window_flag_among_other_args() {
        let args: Vec<String> = vec![
            "norbert.exe".into(),
            "--some-other".into(),
            "--new-window".into(),
            "positional".into(),
        ];
        assert_eq!(parse_launch_intent(&args), LaunchIntent::NewWindow);
    }

    #[test]
    fn decide_launch_action_spawns_first_when_no_existing_window_regardless_of_intent() {
        assert_eq!(
            decide_launch_action(LaunchIntent::Default, false),
            LaunchAction::SpawnFirst
        );
        assert_eq!(
            decide_launch_action(LaunchIntent::NewWindow, false),
            LaunchAction::SpawnFirst
        );
    }

    #[test]
    fn decide_launch_action_focuses_existing_on_default_relaunch() {
        assert_eq!(
            decide_launch_action(LaunchIntent::Default, true),
            LaunchAction::FocusExisting
        );
    }

    #[test]
    fn decide_launch_action_spawns_additional_on_explicit_new_window_relaunch() {
        assert_eq!(
            decide_launch_action(LaunchIntent::NewWindow, true),
            LaunchAction::SpawnAdditional
        );
    }

    #[test]
    fn next_window_label_returns_main_when_no_windows_exist() {
        let labels: Vec<&str> = vec![];
        assert_eq!(next_window_label(&labels), "main");
    }

    #[test]
    fn next_window_label_returns_window_2_when_only_main_exists() {
        let labels = vec!["main"];
        assert_eq!(next_window_label(&labels), "window-2");
    }

    #[test]
    fn next_window_label_skips_taken_numbered_labels() {
        let labels = vec!["main", "window-2", "window-3"];
        assert_eq!(next_window_label(&labels), "window-4");
    }

    #[test]
    fn next_window_label_fills_gaps_in_numbering() {
        // If window-2 was closed, the next spawn reuses window-2.
        let labels = vec!["main", "window-3"];
        assert_eq!(next_window_label(&labels), "window-2");
    }

    #[test]
    fn new_window_flag_constant_matches_documented_cli_arg() {
        assert_eq!(NEW_WINDOW_FLAG, "--new-window");
    }

    #[test]
    fn default_window_label_is_main() {
        assert_eq!(DEFAULT_WINDOW_LABEL, "main");
    }

    // --- Window capability coverage tests ---
    //
    // These tests verify that every label next_window_label can produce
    // matches at least one pattern in capabilities/default.json.
    // Would have caught the original bug where only "main" was listed.

    /// Minimal glob matcher for Tauri capability window patterns.
    /// Supports only trailing `*` (e.g., "window-*"), which is all Tauri uses.
    fn matches_capability_pattern(label: &str, pattern: &str) -> bool {
        if let Some(prefix) = pattern.strip_suffix('*') {
            label.starts_with(prefix)
        } else {
            label == pattern
        }
    }

    /// Parse window patterns from capabilities/default.json.
    fn read_capability_window_patterns() -> Vec<String> {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let path = std::path::Path::new(manifest_dir)
            .join("capabilities")
            .join("default.json");
        let content = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("Cannot read {}: {}", path.display(), e));
        let parsed: serde_json::Value = serde_json::from_str(&content)
            .expect("capabilities/default.json is not valid JSON");
        parsed["windows"]
            .as_array()
            .expect("capabilities/default.json missing 'windows' array")
            .iter()
            .map(|v| v.as_str().expect("window pattern is not a string").to_string())
            .collect()
    }

    fn label_matches_any_pattern(label: &str, patterns: &[String]) -> bool {
        patterns.iter().any(|p| matches_capability_pattern(label, p))
    }

    #[test]
    fn capability_patterns_cover_default_window_label() {
        let patterns = read_capability_window_patterns();
        assert!(
            label_matches_any_pattern(DEFAULT_WINDOW_LABEL, &patterns),
            "Default label '{}' not covered by capability patterns: {:?}",
            DEFAULT_WINDOW_LABEL, patterns
        );
    }

    #[test]
    fn capability_patterns_cover_all_generated_window_labels() {
        let patterns = read_capability_window_patterns();

        // Simulate spawning several windows and verify each label is covered.
        let mut labels: Vec<String> = vec![];
        for _ in 0..10 {
            let refs: Vec<&str> = labels.iter().map(String::as_str).collect();
            let label = next_window_label(&refs);
            assert!(
                label_matches_any_pattern(&label, &patterns),
                "Generated label '{}' not covered by capability patterns: {:?}",
                label, patterns
            );
            labels.push(label);
        }
    }

    #[test]
    fn capability_patterns_cover_gap_filled_labels() {
        let patterns = read_capability_window_patterns();

        // Close window-2, spawn again — should reuse window-2.
        let labels = vec!["main", "window-3", "window-4"];
        let label = next_window_label(&labels);
        assert_eq!(label, "window-2");
        assert!(
            label_matches_any_pattern(&label, &patterns),
            "Gap-filled label '{}' not covered by capability patterns: {:?}",
            label, patterns
        );
    }

    // --- Window creation safety tests ---
    //
    // These verify that the label computation is fully decoupled from
    // the window map, preventing the deadlock where holding a read lock
    // on webview_windows() while calling .build() (which needs a write
    // lock) caused a hang.

    #[test]
    fn next_window_label_is_pure_and_takes_no_app_handle() {
        // next_window_label takes &[&str], not &AppHandle.
        // This test documents the contract: label computation must
        // remain decoupled from Tauri's window registry so callers
        // can drop the registry lock before creating a window.
        let labels = vec!["main", "window-2"];
        let label = next_window_label(&labels);
        assert_eq!(label, "window-3");
        // If this test compiles, the function signature hasn't regressed
        // to take an AppHandle, which would re-introduce the deadlock risk.
    }

    #[test]
    fn next_window_label_result_is_owned_string() {
        // The returned String is fully owned — no borrow from the input slice.
        // This lets callers drop the window map before using the label.
        let labels = vec!["main"];
        let label: String = next_window_label(&labels);
        drop(labels); // would fail to compile if label borrowed from labels
        assert_eq!(label, "window-2");
    }

    // --- Canonical EventType tests ---

    #[test]
    fn event_type_has_eleven_canonical_variants() {
        let variants = vec![
            EventType::SessionStart,
            EventType::SessionEnd,
            EventType::ToolCallStart,
            EventType::ToolCallEnd,
            EventType::AgentComplete,
            EventType::PromptSubmit,
            EventType::ApiRequest,
            EventType::UserPrompt,
            EventType::ToolResult,
            EventType::ApiError,
            EventType::ToolDecision,
        ];
        assert_eq!(variants.len(), 11);
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
        assert_eq!(EventType::ApiRequest.to_string(), "api_request");
        assert_eq!(EventType::UserPrompt.to_string(), "user_prompt");
        assert_eq!(EventType::ToolResult.to_string(), "tool_result");
        assert_eq!(EventType::ApiError.to_string(), "api_error");
        assert_eq!(EventType::ToolDecision.to_string(), "tool_decision");
    }

    #[test]
    fn otel_event_types_serialize_to_snake_case() {
        assert_eq!(
            serde_json::to_string(&EventType::ApiRequest).unwrap(),
            "\"api_request\""
        );
        assert_eq!(
            serde_json::to_string(&EventType::UserPrompt).unwrap(),
            "\"user_prompt\""
        );
        assert_eq!(
            serde_json::to_string(&EventType::ToolResult).unwrap(),
            "\"tool_result\""
        );
        assert_eq!(
            serde_json::to_string(&EventType::ApiError).unwrap(),
            "\"api_error\""
        );
        assert_eq!(
            serde_json::to_string(&EventType::ToolDecision).unwrap(),
            "\"tool_decision\""
        );
    }

    #[test]
    fn otel_event_types_deserialize_from_snake_case() {
        let cases = vec![
            ("\"api_request\"", EventType::ApiRequest),
            ("\"user_prompt\"", EventType::UserPrompt),
            ("\"tool_result\"", EventType::ToolResult),
            ("\"api_error\"", EventType::ApiError),
            ("\"tool_decision\"", EventType::ToolDecision),
        ];
        for (json_str, expected) in cases {
            let deserialized: EventType = serde_json::from_str(json_str).unwrap();
            assert_eq!(deserialized, expected, "Failed to deserialize {}", json_str);
        }
    }

    #[test]
    fn existing_event_types_serialize_unchanged_after_otel_addition() {
        // Verify the original 6 variants still serialize identically
        let original_cases = vec![
            (EventType::SessionStart, "\"session_start\""),
            (EventType::SessionEnd, "\"session_end\""),
            (EventType::ToolCallStart, "\"tool_call_start\""),
            (EventType::ToolCallEnd, "\"tool_call_end\""),
            (EventType::AgentComplete, "\"agent_complete\""),
            (EventType::PromptSubmit, "\"prompt_submit\""),
        ];
        for (variant, expected_json) in original_cases {
            assert_eq!(
                serde_json::to_string(&variant).unwrap(),
                expected_json,
                "Serialization changed for {:?}",
                variant
            );
            let roundtrip: EventType = serde_json::from_str(expected_json).unwrap();
            assert_eq!(
                roundtrip, variant,
                "Deserialization changed for {}",
                expected_json
            );
        }
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
            last_event_at: Some("2026-03-08T10:59:00Z".to_string()),
        };
        assert_eq!(session.id, "sess-abc");
        assert_eq!(session.started_at, "2026-03-08T10:00:00Z");
        assert_eq!(session.ended_at, Some("2026-03-08T11:00:00Z".to_string()));
        assert_eq!(session.event_count, 5);
        assert_eq!(
            session.last_event_at,
            Some("2026-03-08T10:59:00Z".to_string())
        );

        let json = serde_json::to_value(&session).unwrap();
        assert!(json.get("id").is_some());
        assert!(json.get("started_at").is_some());
        assert!(json.get("ended_at").is_some());
        assert!(json.get("event_count").is_some());
        assert!(json.get("last_event_at").is_some());
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
        assert_eq!(
            calculate_duration_seconds("not-a-date", "2026-03-08T10:00:00Z"),
            None
        );
        assert_eq!(
            calculate_duration_seconds("2026-03-08T10:00:00Z", "not-a-date"),
            None
        );
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
            last_event_at: Some("2026-03-08T10:08:12Z".to_string()),
        };
        assert_eq!(derive_status(Some(&ended_session)), "Listening");

        let active_session = Session {
            id: "sess-2".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: None,
            event_count: 5,
            last_event_at: Some("2026-03-08T10:05:00Z".to_string()),
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
            last_event_at: Some("2026-03-08T10:05:00Z".to_string()),
        };
        let status = build_status_with_session(1, 5, Some(&active));
        assert_eq!(status.status, "Active session");
        assert_eq!(status.session_count, 1);
        assert_eq!(status.event_count, 5);

        // No plugin connected when zero counts
        assert_eq!(
            build_status_with_session(0, 0, None).status,
            "No plugin connected"
        );

        // Listening when sessions exist but none active
        let ended = Session {
            id: "sess-1".to_string(),
            started_at: "2026-03-08T10:00:00Z".to_string(),
            ended_at: Some("2026-03-08T10:30:00Z".to_string()),
            event_count: 30,
            last_event_at: Some("2026-03-08T10:30:00Z".to_string()),
        };
        assert_eq!(
            build_status_with_session(1, 30, Some(&ended)).status,
            "Listening"
        );
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
            last_event_at: Some("2026-03-08T10:05:00Z".to_string()),
        };
        assert_eq!(
            derive_connection_status(1, 5, Some(&active_session)),
            "Active session"
        );
    }

}
