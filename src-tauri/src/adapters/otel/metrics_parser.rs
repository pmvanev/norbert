/// OTLP metrics parser: ExportMetricsServiceRequest -> ParsedMetricDataPoint.
///
/// Pure module: parses OTLP/HTTP JSON metrics payloads into flat domain records.
/// No IO imports -- only serde_json for data transformation.
///
/// # Architecture
///
/// - Traverses resourceMetrics[].scopeMetrics[].metrics[].sum.dataPoints[]
/// - Extracts session.id from data point attributes (required, drops without it)
/// - Strips `claude_code.` prefix from metric names
/// - Normalizes model names by removing bracket suffix (e.g., `[1m]`)
/// - Builds compound attribute_key from sorted non-session attributes
/// - Values always from asDouble (f64)

use serde_json::Value;

use super::get_string_attribute;

// ---------------------------------------------------------------
// Domain type: parsed metric data point
// ---------------------------------------------------------------

/// A single parsed metric data point extracted from an OTLP metrics payload.
///
/// Produced by the pure parser, consumed by the metric store adapter.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedMetricDataPoint {
    /// Session identifier from data point attributes.
    pub session_id: String,
    /// Metric name with `claude_code.` prefix stripped.
    pub metric_name: String,
    /// Compound key from sorted non-session attributes.
    pub attribute_key: String,
    /// Metric value (always f64, from asDouble).
    pub value: f64,
    /// Start of delta window (nanosecond timestamp as string).
    pub start_time_nano: String,
    /// End of delta window (nanosecond timestamp as string).
    pub end_time_nano: String,
}

// ---------------------------------------------------------------
// Model name normalization
// ---------------------------------------------------------------

/// Strip trailing bracket suffix from model name.
///
/// Examples: "claude-opus-4-6[1m]" -> "claude-opus-4-6"
///           "claude-opus-4-6" -> "claude-opus-4-6" (unchanged)
fn normalize_model_name(model: &str) -> String {
    match model.rfind('[') {
        Some(bracket_pos) if model.ends_with(']') => model[..bracket_pos].to_string(),
        _ => model.to_string(),
    }
}

// ---------------------------------------------------------------
// Attribute key construction
// ---------------------------------------------------------------

/// Keys to exclude when building the compound attribute key.
const EXCLUDED_ATTRIBUTE_KEYS: &[&str] = &["session.id"];

/// Build a compound attribute key from data point attributes.
///
/// Sorts non-session attributes alphabetically by key, normalizes model values,
/// and joins as "key=value,key=value".
fn build_attribute_key(attributes: &[Value]) -> String {
    let mut pairs: Vec<(String, String)> = attributes
        .iter()
        .filter_map(|attr| {
            let key = attr.get("key")?.as_str()?;
            if EXCLUDED_ATTRIBUTE_KEYS.contains(&key) {
                return None;
            }
            let value = attr.get("value")?;
            let string_value = value
                .get("stringValue")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let normalized_value = if key == "model" {
                normalize_model_name(string_value)
            } else {
                string_value.to_string()
            };

            Some((key.to_string(), normalized_value))
        })
        .collect();

    pairs.sort_by(|a, b| a.0.cmp(&b.0));

    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join(",")
}

// ---------------------------------------------------------------
// Data point parser
// ---------------------------------------------------------------

/// Parse a single metric data point into a ParsedMetricDataPoint.
///
/// Returns None (with warning) if session.id is missing.
fn parse_data_point(
    metric_name: &str,
    data_point: &Value,
) -> Option<ParsedMetricDataPoint> {
    let attributes: Vec<Value> = data_point
        .get("attributes")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // session.id is required -- drop data point without it
    let session_id = get_string_attribute(&attributes, "session.id").or_else(|| {
        eprintln!(
            "Warning: metric data point missing session.id, dropping: {}",
            metric_name
        );
        None
    })?;

    let value = data_point
        .get("asDouble")
        .and_then(|v| v.as_f64())
        .unwrap_or_else(|| {
            eprintln!(
                "Warning: metric data point missing asDouble, defaulting to 0.0: {}",
                metric_name
            );
            0.0
        });

    let start_time_nano = data_point
        .get("startTimeUnixNano")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let end_time_nano = data_point
        .get("timeUnixNano")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let attribute_key = build_attribute_key(&attributes);

    // Strip claude_code. prefix from metric name
    let short_name = metric_name
        .strip_prefix("claude_code.")
        .unwrap_or(metric_name)
        .to_string();

    Some(ParsedMetricDataPoint {
        session_id,
        metric_name: short_name,
        attribute_key,
        value,
        start_time_nano,
        end_time_nano,
    })
}

// ---------------------------------------------------------------
// Envelope parser: top-level public function
// ---------------------------------------------------------------

/// Parse an ExportMetricsServiceRequest JSON into ParsedMetricDataPoints.
///
/// Pure function: traverses resourceMetrics[].scopeMetrics[].metrics[],
/// extracts sum.dataPoints[], and builds flat records.
///
/// - Data points without session.id are dropped with a warning.
/// - Empty metrics arrays produce empty output.
/// - Model names are normalized (bracket suffix stripped).
pub fn parse_export_metrics_request(request: &Value) -> Vec<ParsedMetricDataPoint> {
    let empty_array = Vec::new();
    let resource_metrics = request
        .get("resourceMetrics")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty_array);

    let mut results = Vec::new();

    for resource_metric in resource_metrics {
        let scope_metrics = resource_metric
            .get("scopeMetrics")
            .and_then(|v| v.as_array())
            .unwrap_or(&empty_array);

        for scope_metric in scope_metrics {
            let metrics = scope_metric
                .get("metrics")
                .and_then(|v| v.as_array())
                .unwrap_or(&empty_array);

            for metric in metrics {
                let metric_name = match metric.get("name").and_then(|v| v.as_str()) {
                    Some(name) => name,
                    None => continue,
                };

                let data_points = metric
                    .get("sum")
                    .and_then(|s| s.get("dataPoints"))
                    .and_then(|v| v.as_array())
                    .unwrap_or(&empty_array);

                for data_point in data_points {
                    if let Some(parsed) = parse_data_point(metric_name, data_point) {
                        results.push(parsed);
                    }
                }
            }
        }
    }

    results
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ---------------------------------------------------------------
    // Test helpers
    // ---------------------------------------------------------------

    fn make_data_point(
        session_id: &str,
        value: f64,
        extra_attrs: Vec<Value>,
    ) -> Value {
        let mut attrs = vec![serde_json::json!({
            "key": "session.id",
            "value": {"stringValue": session_id}
        })];
        attrs.extend(extra_attrs);
        serde_json::json!({
            "attributes": attrs,
            "startTimeUnixNano": "1774290634816000000",
            "timeUnixNano": "1774290637123000000",
            "asDouble": value
        })
    }

    fn make_metric(name: &str, data_points: Vec<Value>) -> Value {
        serde_json::json!({
            "name": name,
            "description": "test metric",
            "unit": "test",
            "sum": {
                "aggregationTemporality": 1,
                "isMonotonic": true,
                "dataPoints": data_points
            }
        })
    }

    fn wrap_in_metrics_request(metrics: Vec<Value>) -> Value {
        serde_json::json!({
            "resourceMetrics": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "claude-code"}},
                        {"key": "service.version", "value": {"stringValue": "2.1.81"}}
                    ],
                    "droppedAttributesCount": 0
                },
                "scopeMetrics": [{
                    "scope": {
                        "name": "com.anthropic.claude_code",
                        "version": "2.1.81"
                    },
                    "metrics": metrics
                }]
            }]
        })
    }

    // ---------------------------------------------------------------
    // ACCEPTANCE: Full ExportMetricsServiceRequest -> Vec<ParsedMetricDataPoint>
    // ---------------------------------------------------------------

    #[test]
    fn parses_full_export_metrics_request_with_cost_usage() {
        let data_point = make_data_point(
            "6e2a8c02-aec9-4272-bcde-9843b25ad407",
            0.144065,
            vec![serde_json::json!({
                "key": "model",
                "value": {"stringValue": "claude-opus-4-6[1m]"}
            })],
        );
        let metric = make_metric("claude_code.cost.usage", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);

        assert_eq!(results.len(), 1);
        let point = &results[0];
        assert_eq!(point.session_id, "6e2a8c02-aec9-4272-bcde-9843b25ad407");
        assert_eq!(point.metric_name, "cost.usage");
        assert_eq!(point.attribute_key, "model=claude-opus-4-6");
        assert_eq!(point.value, 0.144065);
        assert_eq!(point.start_time_nano, "1774290634816000000");
        assert_eq!(point.end_time_nano, "1774290637123000000");
    }

    #[test]
    fn parses_multiple_metrics_in_single_request() {
        let cost_point = make_data_point(
            "sess-1",
            0.05,
            vec![serde_json::json!({
                "key": "model",
                "value": {"stringValue": "claude-opus-4-6[1m]"}
            })],
        );
        let token_point = make_data_point(
            "sess-1",
            337.0,
            vec![
                serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}),
                serde_json::json!({"key": "type", "value": {"stringValue": "input"}}),
            ],
        );
        let request = wrap_in_metrics_request(vec![
            make_metric("claude_code.cost.usage", vec![cost_point]),
            make_metric("claude_code.token.usage", vec![token_point]),
        ]);

        let results = parse_export_metrics_request(&request);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].metric_name, "cost.usage");
        assert_eq!(results[1].metric_name, "token.usage");
        assert_eq!(results[1].attribute_key, "model=claude-opus-4-6,type=input");
    }

    // ---------------------------------------------------------------
    // UNIT: Model name normalization
    // ---------------------------------------------------------------

    #[test]
    fn normalize_model_strips_bracket_suffix() {
        assert_eq!(normalize_model_name("claude-opus-4-6[1m]"), "claude-opus-4-6");
    }

    #[test]
    fn normalize_model_strips_longer_bracket_suffix() {
        assert_eq!(
            normalize_model_name("claude-sonnet-4-20250514[200k]"),
            "claude-sonnet-4-20250514"
        );
    }

    #[test]
    fn normalize_model_leaves_name_without_suffix_unchanged() {
        assert_eq!(normalize_model_name("claude-opus-4-6"), "claude-opus-4-6");
    }

    #[test]
    fn normalize_model_handles_empty_string() {
        assert_eq!(normalize_model_name(""), "");
    }

    // ---------------------------------------------------------------
    // UNIT: Data point without session.id dropped
    // ---------------------------------------------------------------

    #[test]
    fn data_point_without_session_id_dropped() {
        let data_point = serde_json::json!({
            "attributes": [
                {"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}
            ],
            "startTimeUnixNano": "1774290634816000000",
            "timeUnixNano": "1774290637123000000",
            "asDouble": 0.05
        });
        let metric = make_metric("claude_code.cost.usage", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    // ---------------------------------------------------------------
    // UNIT: Metric name prefix stripping
    // ---------------------------------------------------------------

    #[test]
    fn strips_claude_code_prefix_from_metric_name() {
        let data_point = make_data_point("sess-1", 1.0, vec![]);
        let metric = make_metric("claude_code.session.count", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].metric_name, "session.count");
    }

    #[test]
    fn preserves_metric_name_without_prefix() {
        let data_point = make_data_point("sess-1", 1.0, vec![]);
        let metric = make_metric("custom.metric", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].metric_name, "custom.metric");
    }

    // ---------------------------------------------------------------
    // UNIT: Compound attribute key construction
    // ---------------------------------------------------------------

    #[test]
    fn attribute_key_empty_when_no_non_session_attributes() {
        let data_point = make_data_point("sess-1", 1.0, vec![]);
        let metric = make_metric("claude_code.session.count", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].attribute_key, "");
    }

    #[test]
    fn attribute_key_sorted_alphabetically() {
        let data_point = make_data_point(
            "sess-1",
            337.0,
            vec![
                serde_json::json!({"key": "type", "value": {"stringValue": "input"}}),
                serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6"}}),
            ],
        );
        let metric = make_metric("claude_code.token.usage", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        // model comes before type alphabetically
        assert_eq!(results[0].attribute_key, "model=claude-opus-4-6,type=input");
    }

    #[test]
    fn attribute_key_normalizes_model_value() {
        let data_point = make_data_point(
            "sess-1",
            0.05,
            vec![serde_json::json!({
                "key": "model",
                "value": {"stringValue": "claude-opus-4-6[1m]"}
            })],
        );
        let metric = make_metric("claude_code.cost.usage", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].attribute_key, "model=claude-opus-4-6");
    }

    #[test]
    fn attribute_key_with_four_attributes_for_code_edit_tool() {
        let data_point = make_data_point(
            "sess-1",
            1.0,
            vec![
                serde_json::json!({"key": "tool_name", "value": {"stringValue": "Bash"}}),
                serde_json::json!({"key": "decision", "value": {"stringValue": "accept"}}),
                serde_json::json!({"key": "source", "value": {"stringValue": "config"}}),
                serde_json::json!({"key": "language", "value": {"stringValue": ""}}),
            ],
        );
        let metric = make_metric("claude_code.code_edit_tool.decision", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(
            results[0].attribute_key,
            "decision=accept,language=,source=config,tool_name=Bash"
        );
    }

    // ---------------------------------------------------------------
    // UNIT: Empty and edge cases
    // ---------------------------------------------------------------

    #[test]
    fn empty_metrics_array_returns_empty_vec() {
        let request = wrap_in_metrics_request(vec![]);
        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    #[test]
    fn empty_resource_metrics_returns_empty_vec() {
        let request = serde_json::json!({"resourceMetrics": []});
        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    #[test]
    fn missing_resource_metrics_returns_empty_vec() {
        let request = serde_json::json!({});
        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    #[test]
    fn metric_without_sum_field_skipped() {
        let metric = serde_json::json!({
            "name": "claude_code.cost.usage",
            "description": "test",
            "unit": "USD"
            // no "sum" field
        });
        let request = wrap_in_metrics_request(vec![metric]);
        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    #[test]
    fn metric_without_name_skipped() {
        let metric = serde_json::json!({
            "description": "test",
            "sum": {
                "aggregationTemporality": 1,
                "isMonotonic": true,
                "dataPoints": [{
                    "attributes": [
                        {"key": "session.id", "value": {"stringValue": "sess-1"}}
                    ],
                    "asDouble": 1.0
                }]
            }
        });
        let request = wrap_in_metrics_request(vec![metric]);
        let results = parse_export_metrics_request(&request);
        assert!(results.is_empty());
    }

    // ---------------------------------------------------------------
    // UNIT: All verified metric types from live spike
    // ---------------------------------------------------------------

    #[test]
    fn parses_session_count_metric() {
        let data_point = make_data_point("sess-1", 1.0, vec![]);
        let metric = make_metric("claude_code.session.count", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metric_name, "session.count");
        assert_eq!(results[0].attribute_key, "");
        assert_eq!(results[0].value, 1.0);
    }

    #[test]
    fn parses_token_usage_metric_with_type_attribute() {
        let data_point = make_data_point(
            "sess-1",
            500.0,
            vec![
                serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}),
                serde_json::json!({"key": "type", "value": {"stringValue": "cacheRead"}}),
            ],
        );
        let metric = make_metric("claude_code.token.usage", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].metric_name, "token.usage");
        assert_eq!(results[0].attribute_key, "model=claude-opus-4-6,type=cacheRead");
        assert_eq!(results[0].value, 500.0);
    }

    #[test]
    fn parses_active_time_metric() {
        let data_point = make_data_point(
            "sess-1",
            42.5,
            vec![serde_json::json!({"key": "type", "value": {"stringValue": "user"}})],
        );
        let metric = make_metric("claude_code.active_time.total", vec![data_point]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results[0].metric_name, "active_time.total");
        assert_eq!(results[0].attribute_key, "type=user");
        assert_eq!(results[0].value, 42.5);
    }

    // ---------------------------------------------------------------
    // UNIT: Multiple data points within a single metric
    // ---------------------------------------------------------------

    #[test]
    fn multiple_data_points_in_single_metric_all_parsed() {
        let dp_input = make_data_point(
            "sess-1",
            100.0,
            vec![
                serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}),
                serde_json::json!({"key": "type", "value": {"stringValue": "input"}}),
            ],
        );
        let dp_output = make_data_point(
            "sess-1",
            50.0,
            vec![
                serde_json::json!({"key": "model", "value": {"stringValue": "claude-opus-4-6[1m]"}}),
                serde_json::json!({"key": "type", "value": {"stringValue": "output"}}),
            ],
        );
        let metric = make_metric("claude_code.token.usage", vec![dp_input, dp_output]);
        let request = wrap_in_metrics_request(vec![metric]);

        let results = parse_export_metrics_request(&request);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].attribute_key, "model=claude-opus-4-6,type=input");
        assert_eq!(results[0].value, 100.0);
        assert_eq!(results[1].attribute_key, "model=claude-opus-4-6,type=output");
        assert_eq!(results[1].value, 50.0);
    }

    // ---------------------------------------------------------------
    // PROPERTY: model normalization (proptest)
    // ---------------------------------------------------------------

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn normalized_model_never_contains_bracket_suffix(
            base in "[a-z][a-z0-9-]{0,30}",
            suffix in "[a-zA-Z0-9]{1,10}"
        ) {
            let with_suffix = format!("{}[{}]", base, suffix);
            let normalized = normalize_model_name(&with_suffix);
            prop_assert!(!normalized.contains('['));
            prop_assert!(!normalized.contains(']'));
            prop_assert_eq!(&normalized, &base);
        }

        #[test]
        fn model_without_brackets_unchanged(name in "[a-z][a-z0-9-]{0,30}") {
            prop_assert_eq!(normalize_model_name(&name), name);
        }
    }
}
