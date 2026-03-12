/// Claude Code provider adapter.
///
/// Pure function adapter that normalizes Claude Code hook payloads
/// into canonical Event types. All types specific to Claude Code
/// are private to this module.
///
/// No IO imports. This module is a pure transformation layer.
use crate::domain::{parse_event_type, Event};
use crate::ports::EventProvider;

/// Claude Code event provider.
///
/// Implements EventProvider to normalize Claude Code hook payloads
/// into canonical events. Stateless -- all normalization is pure.
pub struct ClaudeCodeProvider;

/// The 6 Claude Code hook event names this provider handles.
const CLAUDE_CODE_EVENT_NAMES: &[&str] = &[
    "PreToolUse",
    "PostToolUse",
    "SubagentStop",
    "Stop",
    "SessionStart",
    "UserPromptSubmit",
];

impl EventProvider for ClaudeCodeProvider {
    fn provider_name(&self) -> &str {
        "claude_code"
    }

    fn normalize(
        &self,
        raw_event_type: &str,
        session_id: String,
        payload: serde_json::Value,
        received_at: String,
    ) -> Option<Event> {
        let event_type = parse_event_type(raw_event_type)?;
        Some(Event {
            session_id,
            event_type,
            payload,
            received_at,
            provider: self.provider_name().to_string(),
        })
    }

    fn supported_event_names(&self) -> &[&str] {
        CLAUDE_CODE_EVENT_NAMES
    }
}

/// Extract the tool name from a PreToolUse or PostToolUse payload.
///
/// Claude Code payloads include a "tool" field for tool-related events.
/// Returns None if the field is absent or not a string.
pub fn extract_tool_name(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("tool")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::EventType;
    use serde_json::json;

    // --- Provider identity ---

    #[test]
    fn provider_name_is_claude_code() {
        let provider = ClaudeCodeProvider;
        assert_eq!(provider.provider_name(), "claude_code");
    }

    // --- Event type mapping (all 6 types) ---

    #[test]
    fn normalize_maps_pre_tool_use_to_tool_call_start() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "PreToolUse",
                "sess-1".to_string(),
                json!({"session_id": "sess-1", "tool": "bash"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("PreToolUse should normalize");
        assert_eq!(event.event_type, EventType::ToolCallStart);
    }

    #[test]
    fn normalize_maps_post_tool_use_to_tool_call_end() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "PostToolUse",
                "sess-1".to_string(),
                json!({"session_id": "sess-1", "tool": "Read"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("PostToolUse should normalize");
        assert_eq!(event.event_type, EventType::ToolCallEnd);
    }

    #[test]
    fn normalize_maps_subagent_stop_to_agent_complete() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "SubagentStop",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("SubagentStop should normalize");
        assert_eq!(event.event_type, EventType::AgentComplete);
    }

    #[test]
    fn normalize_maps_stop_to_session_end() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "Stop",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("Stop should normalize");
        assert_eq!(event.event_type, EventType::SessionEnd);
    }

    #[test]
    fn normalize_maps_session_start_to_session_start() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "SessionStart",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("SessionStart should normalize");
        assert_eq!(event.event_type, EventType::SessionStart);
    }

    #[test]
    fn normalize_maps_user_prompt_submit_to_prompt_submit() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "UserPromptSubmit",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("UserPromptSubmit should normalize");
        assert_eq!(event.event_type, EventType::PromptSubmit);
    }

    // --- Session ID extraction ---

    #[test]
    fn normalize_preserves_session_id() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "SessionStart",
                "sess-unique-42".to_string(),
                json!({"session_id": "sess-unique-42"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("should normalize");
        assert_eq!(event.session_id, "sess-unique-42");
    }

    // --- Provider field ---

    #[test]
    fn normalize_sets_provider_to_claude_code() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "Stop",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("should normalize");
        assert_eq!(event.provider, "claude_code");
    }

    // --- Payload preservation ---

    #[test]
    fn normalize_preserves_raw_payload() {
        let provider = ClaudeCodeProvider;
        let payload = json!({"session_id": "sess-1", "tool": "bash", "extra": 42});
        let event = provider
            .normalize(
                "PreToolUse",
                "sess-1".to_string(),
                payload.clone(),
                "2026-03-12T10:00:00Z".to_string(),
            )
            .expect("should normalize");
        assert_eq!(event.payload, payload);
    }

    // --- Timestamp preservation ---

    #[test]
    fn normalize_preserves_received_at_timestamp() {
        let provider = ClaudeCodeProvider;
        let event = provider
            .normalize(
                "SessionStart",
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T14:30:00Z".to_string(),
            )
            .expect("should normalize");
        assert_eq!(event.received_at, "2026-03-12T14:30:00Z");
    }

    // --- Error cases ---

    #[test]
    fn normalize_returns_none_for_unrecognized_event_type() {
        let provider = ClaudeCodeProvider;
        let result = provider.normalize(
            "UnknownEvent",
            "sess-1".to_string(),
            json!({"session_id": "sess-1"}),
            "2026-03-12T10:00:00Z".to_string(),
        );
        assert!(result.is_none());
    }

    #[test]
    fn normalize_returns_none_for_empty_event_type() {
        let provider = ClaudeCodeProvider;
        let result = provider.normalize(
            "",
            "sess-1".to_string(),
            json!({"session_id": "sess-1"}),
            "2026-03-12T10:00:00Z".to_string(),
        );
        assert!(result.is_none());
    }

    #[test]
    fn normalize_returns_none_for_snake_case_event_type() {
        let provider = ClaudeCodeProvider;
        let result = provider.normalize(
            "tool_call_start",
            "sess-1".to_string(),
            json!({"session_id": "sess-1"}),
            "2026-03-12T10:00:00Z".to_string(),
        );
        assert!(result.is_none());
    }

    // --- Tool name extraction ---

    #[test]
    fn extract_tool_name_returns_tool_from_payload() {
        let payload = json!({"session_id": "sess-1", "tool": "bash"});
        assert_eq!(extract_tool_name(&payload), Some("bash".to_string()));
    }

    #[test]
    fn extract_tool_name_returns_none_when_tool_absent() {
        let payload = json!({"session_id": "sess-1"});
        assert_eq!(extract_tool_name(&payload), None);
    }

    #[test]
    fn extract_tool_name_returns_none_when_tool_not_string() {
        let payload = json!({"session_id": "sess-1", "tool": 42});
        assert_eq!(extract_tool_name(&payload), None);
    }

    #[test]
    fn extract_tool_name_handles_various_tool_names() {
        let payload = json!({"tool": "Read"});
        assert_eq!(extract_tool_name(&payload), Some("Read".to_string()));

        let payload = json!({"tool": "Write"});
        assert_eq!(extract_tool_name(&payload), Some("Write".to_string()));

        let payload = json!({"tool": "Glob"});
        assert_eq!(extract_tool_name(&payload), Some("Glob".to_string()));
    }

    // --- Supported event names ---

    #[test]
    fn supported_event_names_contains_all_six_hook_names() {
        let provider = ClaudeCodeProvider;
        let names = provider.supported_event_names();
        assert_eq!(names.len(), 6);
        assert!(names.contains(&"PreToolUse"));
        assert!(names.contains(&"PostToolUse"));
        assert!(names.contains(&"SubagentStop"));
        assert!(names.contains(&"Stop"));
        assert!(names.contains(&"SessionStart"));
        assert!(names.contains(&"UserPromptSubmit"));
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
    use crate::domain::HOOK_EVENT_NAMES;
    use proptest::prelude::*;

    /// Strategy that generates valid Claude Code event type names.
    fn valid_claude_code_event_name() -> impl Strategy<Value = String> {
        prop::sample::select(HOOK_EVENT_NAMES.to_vec()).prop_map(|s| s.to_string())
    }

    proptest! {
        /// Property: every valid Claude Code event name normalizes successfully
        /// and produces a canonical event with provider "claude_code".
        #[test]
        fn all_valid_event_names_normalize_to_claude_code_provider(
            name in valid_claude_code_event_name(),
            session_id in "[a-z0-9-]{1,40}"
        ) {
            let provider = ClaudeCodeProvider;
            let payload = serde_json::json!({"session_id": session_id.clone()});
            let event = provider.normalize(
                &name,
                session_id.clone(),
                payload,
                "2026-03-12T10:00:00Z".to_string(),
            );
            prop_assert!(event.is_some(), "Valid event name '{}' should normalize", name);
            let event = event.unwrap();
            prop_assert_eq!(&event.provider, "claude_code");
            prop_assert_eq!(&event.session_id, &session_id);
        }

        /// Property: arbitrary strings that are not in HOOK_EVENT_NAMES
        /// always return None from normalize.
        #[test]
        fn invalid_event_names_always_return_none(
            name in "[a-z_]{1,30}"
        ) {
            // Only test names that are NOT valid hook event names
            if HOOK_EVENT_NAMES.contains(&name.as_str()) {
                return Ok(());
            }
            let provider = ClaudeCodeProvider;
            let result = provider.normalize(
                &name,
                "sess-1".to_string(),
                serde_json::json!({}),
                "2026-03-12T10:00:00Z".to_string(),
            );
            prop_assert!(result.is_none(), "Invalid event name '{}' should not normalize", name);
        }

        /// Property: extract_tool_name returns Some for any payload with a string "tool" field.
        #[test]
        fn extract_tool_name_succeeds_for_string_tool_field(
            tool_name in "[A-Za-z]{1,20}"
        ) {
            let payload = serde_json::json!({"tool": tool_name});
            let result = extract_tool_name(&payload);
            prop_assert_eq!(result, Some(tool_name));
        }
    }
}
