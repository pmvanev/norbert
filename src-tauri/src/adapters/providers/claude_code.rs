/// Claude Code provider adapter.
///
/// Pure function adapter that normalizes Claude Code hook payloads
/// into canonical Event types. All types specific to Claude Code
/// are private to this module.
///
/// No IO imports. This module is a pure transformation layer.
use crate::domain::{Event, EventType};
use crate::ports::EventProvider;

/// The 6 hook event type names as they appear in Claude Code settings.json.
///
/// These are PascalCase strings matching the Claude Code hook configuration format.
/// Used by the Claude Code adapter to register hooks and by the hook receiver
/// to validate incoming event types.
pub const HOOK_EVENT_NAMES: [&str; 6] = [
    "PreToolUse",
    "PostToolUse",
    "SubagentStop",
    "Stop",
    "SessionStart",
    "UserPromptSubmit",
];

/// Parse a PascalCase event type name from a Claude Code URL path segment
/// into a canonical EventType.
///
/// Claude Code hook URLs use PascalCase names (e.g., "PreToolUse").
/// This function normalizes them into canonical event types.
/// Returns None for unrecognized event type names.
pub fn parse_event_type(name: &str) -> Option<EventType> {
    match name {
        "PreToolUse" => Some(EventType::ToolCallStart),
        "PostToolUse" => Some(EventType::ToolCallEnd),
        "SubagentStop" => Some(EventType::AgentComplete),
        "Stop" => Some(EventType::SessionEnd),
        "SessionStart" => Some(EventType::SessionStart),
        "UserPromptSubmit" => Some(EventType::PromptSubmit),
        _ => None,
    }
}

/// Claude Code event provider.
///
/// Implements EventProvider to normalize Claude Code hook payloads
/// into canonical events. Stateless -- all normalization is pure.
pub struct ClaudeCodeProvider;

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
        &HOOK_EVENT_NAMES
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

    // --- Event type mapping (all 6 types, consolidated) ---

    #[test]
    fn normalize_maps_all_claude_code_names_to_canonical_types() {
        let provider = ClaudeCodeProvider;
        let cases: Vec<(&str, EventType)> = vec![
            ("PreToolUse", EventType::ToolCallStart),
            ("PostToolUse", EventType::ToolCallEnd),
            ("SubagentStop", EventType::AgentComplete),
            ("Stop", EventType::SessionEnd),
            ("SessionStart", EventType::SessionStart),
            ("UserPromptSubmit", EventType::PromptSubmit),
        ];
        for (raw_name, expected_type) in cases {
            let event = provider
                .normalize(
                    raw_name,
                    "sess-1".to_string(),
                    json!({"session_id": "sess-1"}),
                    "2026-03-12T10:00:00Z".to_string(),
                )
                .unwrap_or_else(|| panic!("{} should normalize", raw_name));
            assert_eq!(
                event.event_type, expected_type,
                "{} should map to {:?}",
                raw_name, expected_type
            );
        }
    }

    // --- Normalize preserves all fields ---

    #[test]
    fn normalize_preserves_session_id_provider_payload_and_timestamp() {
        let provider = ClaudeCodeProvider;
        let payload = json!({"session_id": "sess-unique-42", "tool": "bash", "extra": 42});
        let event = provider
            .normalize(
                "PreToolUse",
                "sess-unique-42".to_string(),
                payload.clone(),
                "2026-03-12T14:30:00Z".to_string(),
            )
            .expect("should normalize");
        assert_eq!(event.session_id, "sess-unique-42");
        assert_eq!(event.provider, "claude_code");
        assert_eq!(event.payload, payload);
        assert_eq!(event.received_at, "2026-03-12T14:30:00Z");
    }

    // --- Error cases (consolidated) ---

    #[test]
    fn normalize_returns_none_for_invalid_event_types() {
        let provider = ClaudeCodeProvider;
        let invalid_names = vec!["UnknownEvent", "", "tool_call_start"];
        for name in invalid_names {
            let result = provider.normalize(
                name,
                "sess-1".to_string(),
                json!({"session_id": "sess-1"}),
                "2026-03-12T10:00:00Z".to_string(),
            );
            assert!(result.is_none(), "'{}' should not normalize", name);
        }
    }

    // --- Tool name extraction ---

    #[test]
    fn extract_tool_name_returns_tool_from_payload() {
        let payload = json!({"session_id": "sess-1", "tool": "bash"});
        assert_eq!(extract_tool_name(&payload), Some("bash".to_string()));
    }

    #[test]
    fn extract_tool_name_returns_none_when_tool_absent_or_not_string() {
        assert_eq!(extract_tool_name(&json!({"session_id": "sess-1"})), None);
        assert_eq!(extract_tool_name(&json!({"session_id": "sess-1", "tool": 42})), None);
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

    // --- parse_event_type tests ---

    #[test]
    fn parse_event_type_normalizes_claude_code_names_to_canonical() {
        assert_eq!(parse_event_type("PreToolUse"), Some(EventType::ToolCallStart));
        assert_eq!(parse_event_type("PostToolUse"), Some(EventType::ToolCallEnd));
        assert_eq!(parse_event_type("SubagentStop"), Some(EventType::AgentComplete));
        assert_eq!(parse_event_type("Stop"), Some(EventType::SessionEnd));
        assert_eq!(parse_event_type("SessionStart"), Some(EventType::SessionStart));
        assert_eq!(parse_event_type("UserPromptSubmit"), Some(EventType::PromptSubmit));
    }

    #[test]
    fn parse_event_type_returns_none_for_invalid_inputs() {
        assert_eq!(parse_event_type("UnknownEvent"), None);
        assert_eq!(parse_event_type("tool_call_start"), None);
        assert_eq!(parse_event_type(""), None);
    }

    // --- HOOK_EVENT_NAMES consistency ---

    #[test]
    fn hook_event_names_contains_six_unique_entries() {
        assert_eq!(HOOK_EVENT_NAMES.len(), 6);
        let mut seen = std::collections::HashSet::new();
        for name in &HOOK_EVENT_NAMES {
            assert!(seen.insert(name), "Duplicate entry in HOOK_EVENT_NAMES: {}", name);
        }
    }

    #[test]
    fn every_hook_event_name_is_parseable_and_every_variant_has_a_hook_name() {
        // All EventType variants
        let all_variants = vec![
            EventType::SessionStart,
            EventType::SessionEnd,
            EventType::ToolCallStart,
            EventType::ToolCallEnd,
            EventType::AgentComplete,
            EventType::PromptSubmit,
        ];

        // Every hook name parses successfully
        let parseable_variants: Vec<EventType> = HOOK_EVENT_NAMES
            .iter()
            .map(|name| {
                parse_event_type(name).unwrap_or_else(|| {
                    panic!("HOOK_EVENT_NAMES contains '{}' which parse_event_type does not recognize", name)
                })
            })
            .collect();

        // Same count
        assert_eq!(HOOK_EVENT_NAMES.len(), all_variants.len());

        // Every variant is covered
        for variant in &all_variants {
            assert!(
                parseable_variants.contains(variant),
                "EventType::{:?} has no corresponding entry in HOOK_EVENT_NAMES",
                variant
            );
        }
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
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
