/// OTLP log record parser and event extractors.
///
/// Pure module: parses OTLP/HTTP JSON (ExportLogsServiceRequest) into
/// canonical domain Events. No IO imports — only serde_json for data
/// transformation.
///
/// # Architecture
///
/// - Generic envelope parser traverses resourceLogs[].scopeLogs[].logRecords[]
/// - Per-event-type attribute extractors validate required fields and build payloads
/// - session.id (dot-separated) extracted from log record attributes
/// - All numeric attributes parsed from stringValue to typed values
/// - Unrecognized event names silently ignored
/// - Missing required attributes drop the log record with warning

pub mod metrics_parser;

use crate::domain::{Event, EventType};
use serde_json::Value;

// ---------------------------------------------------------------
// Attribute value extraction: pure functions
// ---------------------------------------------------------------

/// Extract a string from an OTel AnyValue.
///
/// Tries stringValue first, then intValue (which is string-encoded per spec).
fn extract_string_from_value(value: &Value) -> Option<String> {
    value
        .get("stringValue")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            value.get("intValue").and_then(|v| {
                v.as_str()
                    .map(|s| s.to_string())
                    .or_else(|| v.as_i64().map(|n| n.to_string()))
            })
        })
}

/// Extract an i64 from an OTel AnyValue.
///
/// Tries: stringValue -> parse, intValue (string) -> parse, intValue (number),
/// doubleValue -> cast.
fn extract_i64_from_value(value: &Value) -> Option<i64> {
    // Try stringValue first (Claude Code's actual behavior)
    if let Some(s) = value.get("stringValue").and_then(|v| v.as_str()) {
        if let Ok(n) = s.parse::<i64>() {
            return Some(n);
        }
    }
    // Try intValue (string-encoded per OTLP spec)
    if let Some(int_val) = value.get("intValue") {
        if let Some(s) = int_val.as_str() {
            if let Ok(n) = s.parse::<i64>() {
                return Some(n);
            }
        }
        if let Some(n) = int_val.as_i64() {
            return Some(n);
        }
    }
    // Try doubleValue
    if let Some(d) = value.get("doubleValue").and_then(|v| v.as_f64()) {
        return Some(d as i64);
    }
    None
}

/// Extract an f64 from an OTel AnyValue.
///
/// Tries: stringValue -> parse, doubleValue, intValue -> cast.
fn extract_f64_from_value(value: &Value) -> Option<f64> {
    if let Some(s) = value.get("stringValue").and_then(|v| v.as_str()) {
        if let Ok(n) = s.parse::<f64>() {
            return Some(n);
        }
    }
    if let Some(d) = value.get("doubleValue").and_then(|v| v.as_f64()) {
        return Some(d);
    }
    if let Some(int_val) = value.get("intValue") {
        if let Some(s) = int_val.as_str() {
            if let Ok(n) = s.parse::<f64>() {
                return Some(n);
            }
        }
        if let Some(n) = int_val.as_i64() {
            return Some(n as f64);
        }
    }
    None
}

/// Extract a bool from an OTel AnyValue.
///
/// Tries: stringValue -> parse "true"/"false", boolValue.
fn extract_bool_from_value(value: &Value) -> Option<bool> {
    if let Some(s) = value.get("stringValue").and_then(|v| v.as_str()) {
        return match s {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
        };
    }
    value.get("boolValue").and_then(|v| v.as_bool())
}

// ---------------------------------------------------------------
// Attribute lookup helpers on key-value arrays
// ---------------------------------------------------------------

/// Find an attribute by key in an OTel attributes array.
pub(crate) fn find_attribute<'a>(attributes: &'a [Value], key: &str) -> Option<&'a Value> {
    attributes.iter().find_map(|attr| {
        if attr.get("key").and_then(|k| k.as_str()) == Some(key) {
            attr.get("value")
        } else {
            None
        }
    })
}

/// Extract a string attribute by key.
pub fn get_string_attribute(attributes: &[Value], key: &str) -> Option<String> {
    find_attribute(attributes, key).and_then(extract_string_from_value)
}

/// Extract an i64 attribute by key.
fn get_i64_attribute(attributes: &[Value], key: &str) -> Option<i64> {
    find_attribute(attributes, key).and_then(extract_i64_from_value)
}

/// Extract an f64 attribute by key.
fn get_f64_attribute(attributes: &[Value], key: &str) -> Option<f64> {
    find_attribute(attributes, key).and_then(extract_f64_from_value)
}

/// Extract a bool attribute by key.
fn get_bool_attribute(attributes: &[Value], key: &str) -> Option<bool> {
    find_attribute(attributes, key).and_then(extract_bool_from_value)
}

// ---------------------------------------------------------------
// Event-type extractors: pure functions
// ---------------------------------------------------------------

/// Extract api_request payload from log record attributes.
///
/// Required: input_tokens, output_tokens, model.
/// Maps cache_read_tokens -> cache_read_input_tokens,
///      cache_creation_tokens -> cache_creation_input_tokens.
fn extract_api_request_payload(attributes: &[Value]) -> Option<Value> {
    let input_tokens = get_i64_attribute(attributes, "input_tokens")?;
    let output_tokens = get_i64_attribute(attributes, "output_tokens")?;
    let model = get_string_attribute(attributes, "model")?;

    let cache_read = get_i64_attribute(attributes, "cache_read_tokens").unwrap_or(0);
    let cache_creation = get_i64_attribute(attributes, "cache_creation_tokens").unwrap_or(0);

    let mut usage = serde_json::json!({
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "model": model,
        "cache_read_input_tokens": cache_read,
        "cache_creation_input_tokens": cache_creation,
    });

    if let Some(cost) = get_f64_attribute(attributes, "cost_usd") {
        usage["cost_usd"] = serde_json::json!(cost);
    }
    if let Some(duration) = get_i64_attribute(attributes, "duration_ms") {
        usage["duration_ms"] = serde_json::json!(duration);
    }
    if let Some(speed) = get_string_attribute(attributes, "speed") {
        usage["speed"] = serde_json::json!(speed);
    }

    Some(serde_json::json!({"usage": usage}))
}

/// Extract user_prompt payload from log record attributes.
///
/// Required: prompt_length. Optional: prompt.
fn extract_user_prompt_payload(attributes: &[Value]) -> Option<Value> {
    let prompt_length = get_i64_attribute(attributes, "prompt_length")?;

    let mut prompt = serde_json::json!({
        "prompt_length": prompt_length,
    });

    if let Some(content) = get_string_attribute(attributes, "prompt") {
        prompt["content"] = serde_json::json!(content);
    }

    Some(serde_json::json!({"prompt": prompt}))
}

/// Extract tool_result payload from log record attributes.
///
/// Required: tool_name. Optional: success, duration_ms, error,
/// tool_result_size_bytes, tool_parameters, mcp_server_scope,
/// decision_source, decision_type.
fn extract_tool_result_payload(attributes: &[Value]) -> Option<Value> {
    let tool_name = get_string_attribute(attributes, "tool_name")?;

    let mut tool = serde_json::json!({
        "tool_name": tool_name,
    });

    if let Some(success) = get_bool_attribute(attributes, "success") {
        tool["success"] = serde_json::json!(success);
    }
    if let Some(duration) = get_i64_attribute(attributes, "duration_ms") {
        tool["duration_ms"] = serde_json::json!(duration);
    }
    if let Some(error) = get_string_attribute(attributes, "error") {
        tool["error"] = serde_json::json!(error);
    }
    if let Some(size) = get_i64_attribute(attributes, "tool_result_size_bytes") {
        tool["result_size_bytes"] = serde_json::json!(size);
    }
    if let Some(params) = get_string_attribute(attributes, "tool_parameters") {
        tool["parameters"] = serde_json::json!(params);
    }
    if let Some(scope) = get_string_attribute(attributes, "mcp_server_scope") {
        tool["mcp_server_scope"] = serde_json::json!(scope);
    }
    if let Some(source) = get_string_attribute(attributes, "decision_source") {
        tool["decision_source"] = serde_json::json!(source);
    }
    if let Some(dtype) = get_string_attribute(attributes, "decision_type") {
        tool["decision_type"] = serde_json::json!(dtype);
    }

    Some(serde_json::json!({"tool": tool}))
}

/// Extract api_error payload from log record attributes.
///
/// Required: error. Optional: model, status_code, duration_ms, attempt, speed.
fn extract_api_error_payload(attributes: &[Value]) -> Option<Value> {
    let error = get_string_attribute(attributes, "error")?;

    let mut error_obj = serde_json::json!({
        "error": error,
    });

    if let Some(model) = get_string_attribute(attributes, "model") {
        error_obj["model"] = serde_json::json!(model);
    }
    if let Some(code) = get_i64_attribute(attributes, "status_code") {
        error_obj["status_code"] = serde_json::json!(code);
    }
    if let Some(duration) = get_i64_attribute(attributes, "duration_ms") {
        error_obj["duration_ms"] = serde_json::json!(duration);
    }
    if let Some(attempt) = get_i64_attribute(attributes, "attempt") {
        error_obj["attempt"] = serde_json::json!(attempt);
    }
    if let Some(speed) = get_string_attribute(attributes, "speed") {
        error_obj["speed"] = serde_json::json!(speed);
    }

    Some(serde_json::json!({"error": error_obj}))
}

/// Extract tool_decision payload from log record attributes.
///
/// Required: tool_name. Optional: decision, source.
fn extract_tool_decision_payload(attributes: &[Value]) -> Option<Value> {
    let tool_name = get_string_attribute(attributes, "tool_name")?;

    let mut decision = serde_json::json!({
        "tool_name": tool_name,
    });

    if let Some(decision_value) = get_string_attribute(attributes, "decision") {
        decision["decision"] = serde_json::json!(decision_value);
    }
    if let Some(source) = get_string_attribute(attributes, "source") {
        decision["source"] = serde_json::json!(source);
    }

    Some(serde_json::json!({"decision": decision}))
}

// ---------------------------------------------------------------
// Event name routing
// ---------------------------------------------------------------

/// Route a Claude Code event name to its EventType and payload extractor.
///
/// Returns None for unrecognized event names (silently ignored).
fn route_event_name(event_name: &str, attributes: &[Value]) -> Option<(EventType, Value)> {
    let short_name = event_name
        .strip_prefix("claude_code.")
        .unwrap_or(event_name);

    match short_name {
        "api_request" => extract_api_request_payload(attributes)
            .map(|p| (EventType::ApiRequest, p)),
        "user_prompt" => extract_user_prompt_payload(attributes)
            .map(|p| (EventType::UserPrompt, p)),
        "tool_result" => extract_tool_result_payload(attributes)
            .map(|p| (EventType::ToolResult, p)),
        "api_error" => extract_api_error_payload(attributes)
            .map(|p| (EventType::ApiError, p)),
        "tool_decision" => extract_tool_decision_payload(attributes)
            .map(|p| (EventType::ToolDecision, p)),
        _ => None,
    }
}

// ---------------------------------------------------------------
// Session enrichment extractors: pure functions
// ---------------------------------------------------------------

/// Extract terminal.type from the first log record that has it.
///
/// Pure function: traverses all log records in the request looking for
/// a `terminal.type` attribute. Returns the first value found, or None.
pub fn extract_terminal_type_from_logs_request(request: &Value) -> Option<String> {
    let empty_array = Vec::new();
    let resource_logs = request
        .get("resourceLogs")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty_array);

    for resource_log in resource_logs {
        let scope_logs = resource_log
            .get("scopeLogs")
            .and_then(|v| v.as_array())
            .unwrap_or(&empty_array);

        for scope_log in scope_logs {
            let log_records = scope_log
                .get("logRecords")
                .and_then(|v| v.as_array())
                .unwrap_or(&empty_array);

            for log_record in log_records {
                let attributes = log_record
                    .get("attributes")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                if let Some(terminal_type) = get_string_attribute(&attributes, "terminal.type") {
                    return Some(terminal_type);
                }
            }
        }
    }

    None
}

/// Extract resource attributes from an OTLP logs request.
///
/// Pure function: traverses resourceLogs[0].resource.attributes[]
/// and extracts service.version, os.type, host.arch.
pub fn extract_log_resource_attributes(request: &Value) -> (Option<String>, Option<String>, Option<String>) {
    let resource_attrs = request
        .get("resourceLogs")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|rl| rl.get("resource"))
        .and_then(|r| r.get("attributes"))
        .and_then(|v| v.as_array());

    match resource_attrs {
        Some(attrs) => {
            let service_version = get_string_attribute(attrs, "service.version");
            let os_type = get_string_attribute(attrs, "os.type");
            let host_arch = get_string_attribute(attrs, "host.arch");
            (service_version, os_type, host_arch)
        }
        None => (None, None, None),
    }
}

// ---------------------------------------------------------------
// Envelope parser: top-level public function
// ---------------------------------------------------------------

/// Parse an ExportLogsServiceRequest JSON into canonical domain Events.
///
/// Pure function: traverses resourceLogs[].scopeLogs[].logRecords[],
/// extracts session.id from log record attributes, routes by event name
/// to type-specific extractors, and builds Event values.
///
/// - Unrecognized event names are silently ignored.
/// - Missing required attributes drop the log record (with eprintln warning).
/// - Missing session.id drops the log record.
pub fn parse_export_logs_request(request: &Value, received_at: &str) -> Vec<Event> {
    let empty_array = Vec::new();
    let resource_logs = request
        .get("resourceLogs")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty_array);

    let mut events = Vec::new();

    for resource_log in resource_logs {
        let scope_logs = resource_log
            .get("scopeLogs")
            .and_then(|v| v.as_array())
            .unwrap_or(&empty_array);

        for scope_log in scope_logs {
            let log_records = scope_log
                .get("logRecords")
                .and_then(|v| v.as_array())
                .unwrap_or(&empty_array);

            for log_record in log_records {
                if let Some(event) = parse_log_record(log_record, received_at) {
                    events.push(event);
                }
            }
        }
    }

    events
}

/// Parse a single log record into an Event.
///
/// Returns None if the log record is missing session.id, has an
/// unrecognized event name, or is missing required attributes.
fn parse_log_record(log_record: &Value, received_at: &str) -> Option<Event> {
    let attributes: Vec<Value> = log_record
        .get("attributes")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // Extract event name from body.stringValue
    let event_name = log_record
        .get("body")
        .and_then(|b| b.get("stringValue"))
        .and_then(|v| v.as_str())?;

    // Only process claude_code events
    if !event_name.starts_with("claude_code.") {
        return None;
    }

    // Extract session.id from log record attributes (required)
    let session_id = get_string_attribute(&attributes, "session.id").or_else(|| {
        eprintln!(
            "Warning: log record missing session.id, dropping: {}",
            event_name
        );
        None
    })?;

    // Route to type-specific extractor
    let (event_type, mut payload) = route_event_name(event_name, &attributes)?;

    // Add cross-event correlation fields
    if let Some(prompt_id) = get_string_attribute(&attributes, "prompt.id") {
        payload["prompt_id"] = serde_json::json!(prompt_id);
    }
    if let Some(sequence) = get_i64_attribute(&attributes, "event.sequence") {
        payload["event_sequence"] = serde_json::json!(sequence);
    }

    Some(Event {
        session_id,
        event_type,
        payload,
        received_at: received_at.to_string(),
        provider: "claude_code".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use crate::domain::EventType;

    // ---------------------------------------------------------------
    // Helper: build a full ExportLogsServiceRequest JSON
    // ---------------------------------------------------------------

    fn make_log_record(event_name: &str, attributes: Vec<serde_json::Value>) -> serde_json::Value {
        let mut attrs = vec![
            serde_json::json!({"key": "session.id", "value": {"stringValue": "6e2a8c02-aec9-4272-bcde-9843b25ad407"}}),
            serde_json::json!({"key": "event.name", "value": {"stringValue": event_name.split('.').last().unwrap_or(event_name)}}),
            serde_json::json!({"key": "event.timestamp", "value": {"stringValue": "2026-03-23T18:30:33.104Z"}}),
            serde_json::json!({"key": "event.sequence", "value": {"intValue": "1"}}),
            serde_json::json!({"key": "prompt.id", "value": {"stringValue": "bacb8cf6-24af-455c-8167-2728c5700077"}}),
        ];
        attrs.extend(attributes);
        serde_json::json!({
            "timeUnixNano": "1774290633104000000",
            "observedTimeUnixNano": "1774290633104000000",
            "body": {"stringValue": event_name},
            "attributes": attrs,
            "droppedAttributesCount": 0
        })
    }

    fn wrap_in_export_request(log_records: Vec<serde_json::Value>) -> serde_json::Value {
        serde_json::json!({
            "resourceLogs": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "claude-code"}},
                        {"key": "service.version", "value": {"stringValue": "2.1.81"}}
                    ],
                    "droppedAttributesCount": 0
                },
                "scopeLogs": [{
                    "scope": {
                        "name": "com.anthropic.claude_code.events",
                        "version": "2.1.81"
                    },
                    "logRecords": log_records
                }]
            }]
        })
    }

    // ---------------------------------------------------------------
    // ACCEPTANCE TEST: Full ExportLogsServiceRequest -> Vec<Event>
    // ---------------------------------------------------------------

    #[test]
    fn parses_full_export_request_with_api_request_event() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "337"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "12"}}),
            serde_json::json!({"key": "cache_read_tokens", "value": {"stringValue": "100"}}),
            serde_json::json!({"key": "cache_creation_tokens", "value": {"stringValue": "22996"}}),
            serde_json::json!({"key": "cost_usd", "value": {"stringValue": "0.144065"}}),
            serde_json::json!({"key": "duration_ms", "value": {"stringValue": "2504"}}),
            serde_json::json!({"key": "speed", "value": {"stringValue": "normal"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "2026-03-23T18:30:34.817Z");

        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.session_id, "6e2a8c02-aec9-4272-bcde-9843b25ad407");
        assert_eq!(event.event_type, EventType::ApiRequest);
        assert_eq!(event.provider, "claude_code");
        assert_eq!(event.received_at, "2026-03-23T18:30:34.817Z");

        // Verify payload structure with renamed fields
        let usage = &event.payload["usage"];
        assert_eq!(usage["input_tokens"], 337);
        assert_eq!(usage["output_tokens"], 12);
        assert_eq!(usage["cache_read_input_tokens"], 100);
        assert_eq!(usage["cache_creation_input_tokens"], 22996);
        assert_eq!(usage["cost_usd"], 0.144065);
        assert_eq!(usage["model"], "claude-opus-4-6");
        assert_eq!(usage["duration_ms"], 2504);
        assert_eq!(usage["speed"], "normal");

        // prompt.id preserved for cross-event correlation
        assert_eq!(event.payload["prompt_id"], "bacb8cf6-24af-455c-8167-2728c5700077");
        assert_eq!(event.payload["event_sequence"], 1);
    }

    #[test]
    fn parses_multiple_event_types_in_single_request() {
        let api_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let prompt_record = make_log_record("claude_code.user_prompt", vec![
            serde_json::json!({"key": "prompt_length", "value": {"stringValue": "5"}}),
            serde_json::json!({"key": "prompt", "value": {"stringValue": "hello"}}),
        ]);
        let request = wrap_in_export_request(vec![api_record, prompt_record]);

        let events = super::parse_export_logs_request(&request, "2026-03-23T18:30:34.817Z");

        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_type, EventType::ApiRequest);
        assert_eq!(events[1].event_type, EventType::UserPrompt);
    }

    // ---------------------------------------------------------------
    // UNIT: user_prompt extractor
    // ---------------------------------------------------------------

    #[test]
    fn extracts_user_prompt_event() {
        let log_record = make_log_record("claude_code.user_prompt", vec![
            serde_json::json!({"key": "prompt_length", "value": {"stringValue": "5"}}),
            serde_json::json!({"key": "prompt", "value": {"stringValue": "hello"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        let payload = &events[0].payload;
        assert_eq!(payload["prompt"]["prompt_length"], 5);
        assert_eq!(payload["prompt"]["content"], "hello");
        assert_eq!(payload["prompt_id"], "bacb8cf6-24af-455c-8167-2728c5700077");
    }

    #[test]
    fn user_prompt_without_prompt_content_still_parses() {
        let log_record = make_log_record("claude_code.user_prompt", vec![
            serde_json::json!({"key": "prompt_length", "value": {"stringValue": "5"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].payload["prompt"]["prompt_length"], 5);
        // prompt content should be absent or null
        assert!(events[0].payload["prompt"].get("content").is_none()
            || events[0].payload["prompt"]["content"].is_null());
    }

    // ---------------------------------------------------------------
    // UNIT: tool_result extractor
    // ---------------------------------------------------------------

    #[test]
    fn extracts_tool_result_event() {
        let log_record = make_log_record("claude_code.tool_result", vec![
            serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
            serde_json::json!({"key": "success", "value": {"stringValue": "true"}}),
            serde_json::json!({"key": "duration_ms", "value": {"stringValue": "17903"}}),
            serde_json::json!({"key": "error", "value": {"stringValue": "none"}}),
            serde_json::json!({"key": "tool_result_size_bytes", "value": {"stringValue": "457"}}),
            serde_json::json!({"key": "decision_source", "value": {"stringValue": "config"}}),
            serde_json::json!({"key": "decision_type", "value": {"stringValue": "accept"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        let tool = &events[0].payload["tool"];
        assert_eq!(tool["tool_name"], "Bash");
        assert_eq!(tool["success"], true);
        assert_eq!(tool["duration_ms"], 17903);
        assert_eq!(tool["result_size_bytes"], 457);
        assert_eq!(tool["decision_source"], "config");
        assert_eq!(tool["decision_type"], "accept");
    }

    #[test]
    fn tool_result_with_only_required_fields() {
        let log_record = make_log_record("claude_code.tool_result", vec![
            serde_json::json!({"key": "tool_name", "value": {"stringValue": "Read"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].payload["tool"]["tool_name"], "Read");
    }

    // ---------------------------------------------------------------
    // UNIT: api_error extractor
    // ---------------------------------------------------------------

    #[test]
    fn extracts_api_error_event() {
        let log_record = make_log_record("claude_code.api_error", vec![
            serde_json::json!({"key": "error", "value": {"stringValue": "rate_limit_exceeded"}}),
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-sonnet-4-20250514"}}),
            serde_json::json!({"key": "status_code", "value": {"stringValue": "429"}}),
            serde_json::json!({"key": "duration_ms", "value": {"stringValue": "150"}}),
            serde_json::json!({"key": "attempt", "value": {"stringValue": "1"}}),
            serde_json::json!({"key": "speed", "value": {"stringValue": "normal"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        let error = &events[0].payload["error"];
        assert_eq!(error["error"], "rate_limit_exceeded");
        assert_eq!(error["model"], "claude-sonnet-4-20250514");
        assert_eq!(error["status_code"], 429);
        assert_eq!(error["duration_ms"], 150);
        assert_eq!(error["attempt"], 1);
        assert_eq!(error["speed"], "normal");
    }

    // ---------------------------------------------------------------
    // UNIT: tool_decision extractor
    // ---------------------------------------------------------------

    #[test]
    fn extracts_tool_decision_event() {
        let log_record = make_log_record("claude_code.tool_decision", vec![
            serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
            serde_json::json!({"key": "decision", "value": {"stringValue": "accept"}}),
            serde_json::json!({"key": "source", "value": {"stringValue": "config"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        let decision = &events[0].payload["decision"];
        assert_eq!(decision["tool_name"], "Bash");
        assert_eq!(decision["decision"], "accept");
        assert_eq!(decision["source"], "config");
    }

    // ---------------------------------------------------------------
    // UNIT: session.id extraction
    // ---------------------------------------------------------------

    #[test]
    fn extracts_session_id_from_log_record_attributes() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events[0].session_id, "6e2a8c02-aec9-4272-bcde-9843b25ad407");
    }

    #[test]
    fn missing_session_id_drops_log_record() {
        // Build a log record without session.id in attributes
        let log_record = serde_json::json!({
            "timeUnixNano": "1774290633104000000",
            "observedTimeUnixNano": "1774290633104000000",
            "body": {"stringValue": "claude_code.api_request"},
            "attributes": [
                {"key": "event.name", "value": {"stringValue": "api_request"}},
                {"key": "model", "value": {"stringValue": "claude-opus-4-6"}},
                {"key": "input_tokens", "value": {"stringValue": "3"}},
                {"key": "output_tokens", "value": {"stringValue": "13"}}
            ],
            "droppedAttributesCount": 0
        });
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    // ---------------------------------------------------------------
    // UNIT: missing required attributes drop log record
    // ---------------------------------------------------------------

    #[test]
    fn api_request_missing_required_input_tokens_drops_record() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            // missing input_tokens
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn api_request_missing_required_model_drops_record() {
        let log_record = make_log_record("claude_code.api_request", vec![
            // missing model
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn user_prompt_missing_prompt_length_drops_record() {
        let log_record = make_log_record("claude_code.user_prompt", vec![
            serde_json::json!({"key": "prompt", "value": {"stringValue": "hello"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn tool_result_missing_tool_name_drops_record() {
        let log_record = make_log_record("claude_code.tool_result", vec![
            serde_json::json!({"key": "success", "value": {"stringValue": "true"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn api_error_missing_error_drops_record() {
        let log_record = make_log_record("claude_code.api_error", vec![
            serde_json::json!({"key": "status_code", "value": {"stringValue": "429"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn tool_decision_missing_tool_name_drops_record() {
        let log_record = make_log_record("claude_code.tool_decision", vec![
            serde_json::json!({"key": "decision", "value": {"stringValue": "accept"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    // ---------------------------------------------------------------
    // UNIT: unrecognized events silently ignored
    // ---------------------------------------------------------------

    #[test]
    fn unrecognized_event_name_silently_ignored() {
        let log_record = make_log_record("claude_code.unknown_event", vec![
            serde_json::json!({"key": "some_field", "value": {"stringValue": "value"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn non_claude_code_event_silently_ignored() {
        let log_record = make_log_record("other_service.some_event", vec![
            serde_json::json!({"key": "some_field", "value": {"stringValue": "value"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 0);
    }

    // ---------------------------------------------------------------
    // UNIT: numeric parsing from stringValue
    // ---------------------------------------------------------------

    #[test]
    fn parses_numeric_from_string_value() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "337"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "12"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        let usage = &events[0].payload["usage"];
        assert_eq!(usage["input_tokens"], 337);
        assert_eq!(usage["output_tokens"], 12);
    }

    #[test]
    fn parses_numeric_from_int_value_fallback() {
        // Test that intValue is accepted as fallback for numeric fields
        let attrs = vec![
            serde_json::json!({"key": "session.id", "value": {"stringValue": "6e2a8c02-aec9-4272-bcde-9843b25ad407"}}),
            serde_json::json!({"key": "event.name", "value": {"stringValue": "api_request"}}),
            serde_json::json!({"key": "event.timestamp", "value": {"stringValue": "2026-03-23T18:30:33.104Z"}}),
            serde_json::json!({"key": "event.sequence", "value": {"intValue": "1"}}),
            serde_json::json!({"key": "prompt.id", "value": {"stringValue": "bacb8cf6-24af-455c-8167-2728c5700077"}}),
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"intValue": "337"}}),
            serde_json::json!({"key": "output_tokens", "value": {"intValue": "12"}}),
        ];
        let log_record = serde_json::json!({
            "timeUnixNano": "1774290633104000000",
            "observedTimeUnixNano": "1774290633104000000",
            "body": {"stringValue": "claude_code.api_request"},
            "attributes": attrs,
            "droppedAttributesCount": 0
        });
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].payload["usage"]["input_tokens"], 337);
        assert_eq!(events[0].payload["usage"]["output_tokens"], 12);
    }

    // ---------------------------------------------------------------
    // UNIT: api_request cache field renaming
    // ---------------------------------------------------------------

    #[test]
    fn api_request_renames_cache_fields() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
            serde_json::json!({"key": "cache_read_tokens", "value": {"stringValue": "100"}}),
            serde_json::json!({"key": "cache_creation_tokens", "value": {"stringValue": "200"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        let usage = &events[0].payload["usage"];
        // Renamed from cache_read_tokens -> cache_read_input_tokens
        assert_eq!(usage["cache_read_input_tokens"], 100);
        // Renamed from cache_creation_tokens -> cache_creation_input_tokens
        assert_eq!(usage["cache_creation_input_tokens"], 200);
        // Original names should NOT be present
        assert!(usage.get("cache_read_tokens").is_none());
        assert!(usage.get("cache_creation_tokens").is_none());
    }

    // ---------------------------------------------------------------
    // UNIT: api_request defaults cache to 0 when absent
    // ---------------------------------------------------------------

    #[test]
    fn api_request_defaults_cache_tokens_to_zero() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        let usage = &events[0].payload["usage"];
        assert_eq!(usage["cache_read_input_tokens"], 0);
        assert_eq!(usage["cache_creation_input_tokens"], 0);
    }

    // ---------------------------------------------------------------
    // UNIT: prompt.id preserved in payload
    // ---------------------------------------------------------------

    #[test]
    fn prompt_id_preserved_in_all_event_types() {
        let event_configs = vec![
            ("claude_code.api_request", vec![
                serde_json::json!({"key": "model", "value": {"stringValue": "m"}}),
                serde_json::json!({"key": "input_tokens", "value": {"stringValue": "1"}}),
                serde_json::json!({"key": "output_tokens", "value": {"stringValue": "1"}}),
            ]),
            ("claude_code.user_prompt", vec![
                serde_json::json!({"key": "prompt_length", "value": {"stringValue": "5"}}),
            ]),
            ("claude_code.tool_result", vec![
                serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
            ]),
            ("claude_code.api_error", vec![
                serde_json::json!({"key": "error", "value": {"stringValue": "err"}}),
            ]),
            ("claude_code.tool_decision", vec![
                serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
            ]),
        ];

        for (event_name, attrs) in event_configs {
            let log_record = make_log_record(event_name, attrs);
            let request = wrap_in_export_request(vec![log_record]);
            let events = super::parse_export_logs_request(&request, "now");
            assert_eq!(events.len(), 1, "Expected 1 event for {}", event_name);
            assert_eq!(
                events[0].payload["prompt_id"],
                "bacb8cf6-24af-455c-8167-2728c5700077",
                "prompt_id missing for {}",
                event_name
            );
        }
    }

    // ---------------------------------------------------------------
    // UNIT: empty / malformed request
    // ---------------------------------------------------------------

    #[test]
    fn empty_resource_logs_returns_empty_vec() {
        let request = serde_json::json!({"resourceLogs": []});
        let events = super::parse_export_logs_request(&request, "now");
        assert!(events.is_empty());
    }

    #[test]
    fn missing_resource_logs_returns_empty_vec() {
        let request = serde_json::json!({});
        let events = super::parse_export_logs_request(&request, "now");
        assert!(events.is_empty());
    }

    // ---------------------------------------------------------------
    // UNIT: bool parsing from stringValue
    // ---------------------------------------------------------------

    // ---------------------------------------------------------------
    // UNIT: terminal.type extraction from log records
    // ---------------------------------------------------------------

    #[test]
    fn extracts_terminal_type_from_log_record_attributes() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
            serde_json::json!({"key": "terminal.type", "value": {"stringValue": "vscode"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let terminal_type = super::extract_terminal_type_from_logs_request(&request);
        assert_eq!(terminal_type, Some("vscode".to_string()));
    }

    #[test]
    fn terminal_type_none_when_missing_from_all_log_records() {
        let log_record = make_log_record("claude_code.api_request", vec![
            serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            serde_json::json!({"key": "input_tokens", "value": {"stringValue": "3"}}),
            serde_json::json!({"key": "output_tokens", "value": {"stringValue": "13"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let terminal_type = super::extract_terminal_type_from_logs_request(&request);
        assert_eq!(terminal_type, None);
    }

    #[test]
    fn terminal_type_extracted_from_empty_resource_logs() {
        let request = serde_json::json!({"resourceLogs": []});
        let terminal_type = super::extract_terminal_type_from_logs_request(&request);
        assert_eq!(terminal_type, None);
    }

    // ---------------------------------------------------------------
    // UNIT: resource attribute extraction from log requests
    // ---------------------------------------------------------------

    #[test]
    fn extracts_resource_attributes_from_logs_request() {
        let request = serde_json::json!({
            "resourceLogs": [{
                "resource": {
                    "attributes": [
                        {"key": "service.version", "value": {"stringValue": "2.1.81"}},
                        {"key": "os.type", "value": {"stringValue": "linux"}},
                        {"key": "host.arch", "value": {"stringValue": "x86_64"}}
                    ]
                },
                "scopeLogs": []
            }]
        });

        let (sv, os, arch) = super::extract_log_resource_attributes(&request);
        assert_eq!(sv, Some("2.1.81".to_string()));
        assert_eq!(os, Some("linux".to_string()));
        assert_eq!(arch, Some("x86_64".to_string()));
    }

    #[test]
    fn missing_resource_attributes_returns_none_tuple() {
        let request = serde_json::json!({"resourceLogs": []});
        let (sv, os, arch) = super::extract_log_resource_attributes(&request);
        assert_eq!(sv, None);
        assert_eq!(os, None);
        assert_eq!(arch, None);
    }

    #[test]
    fn tool_result_parses_success_from_string_value() {
        let log_record = make_log_record("claude_code.tool_result", vec![
            serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
            serde_json::json!({"key": "success", "value": {"stringValue": "false"}}),
        ]);
        let request = wrap_in_export_request(vec![log_record]);

        let events = super::parse_export_logs_request(&request, "now");
        assert_eq!(events[0].payload["tool"]["success"], false);
    }
}
