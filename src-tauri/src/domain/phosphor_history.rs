/// Phosphor history aggregation — pure functions for the Performance Monitor
/// startup backfill.
///
/// The scope on the Performance Monitor shows a 60-second rolling window of
/// per-session activity. Under the live-only ingest path the scope starts
/// empty and takes a full minute to fill, which is a poor first impression
/// when the DB already contains plenty of recent history. This module
/// aggregates raw events into per-session, per-time-bucket counts that the
/// frontend can paint onto the scope immediately on startup.
///
/// Counting rules mirror the frontend's hookProcessor so the backfill and
/// the live stream agree on what each metric means:
///   - `events` — every event in the bucket, regardless of type.
///   - `toolcalls` — events whose canonical event_type is one of the three
///     tool variants (tool_call_start, tool_call_end, tool_result).
///   - `tokens` — sum of `input_tokens + cache_creation_input_tokens` on
///     `api_request` events. This matches Anthropic's ITPM rate-limit
///     accounting on modern Claude 4.x models; cache-read tokens do not
///     count toward ITPM and are deliberately excluded.
///
/// Pure: no IO, no clock access, no globals. The caller supplies the cutoff
/// timestamp, bucket size, and event slice. Unit tests drive the function
/// directly.

use crate::domain::Event;
use serde::Serialize;
use std::collections::BTreeMap;

/// Event types that contribute to the tool-calls-per-second metric.
///
/// Matches the canonical snake_case names emitted by `EventType::Display`
/// and persisted to the events table.
const TOOL_EVENT_TYPES: &[&str] = &["tool_call_start", "tool_call_end", "tool_result"];

/// A single per-session, per-bucket phosphor history entry.
///
/// `bucket_end_ms` is the epoch-millisecond timestamp the frontend will use
/// as the sample's `t` value — it is the END of the window, not the start,
/// so the sample aligns with the "rate as of tick boundary" semantics the
/// live stream uses.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PhosphorHistoryBucket {
    pub session_id: String,
    pub bucket_end_ms: i64,
    pub events: u32,
    pub toolcalls: u32,
    pub tokens: u32,
}

/// Response envelope for the phosphor-history backfill IPC.
///
/// `query_time_ms` is the backend clock reading at the moment the DB
/// snapshot was captured. It becomes the exclusive upper bound between
/// backfill and live streams — the frontend primes the live-rate boundary
/// at this timestamp so events received at or after `query_time_ms` flow
/// exclusively through the live counter and events before it were already
/// painted by the buckets in this response. That split eliminates both the
/// visible gap (the live stream picks up exactly where backfill left off)
/// and the double-count risk (no event straddles the seam).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PhosphorHistoryResponse {
    pub buckets: Vec<PhosphorHistoryBucket>,
    pub query_time_ms: i64,
}

/// Parse an RFC3339 / ISO-8601 timestamp into epoch milliseconds.
/// Returns None on malformed input so callers can skip degenerate rows.
pub fn parse_iso_ms(ts: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(ts)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

fn is_tool_call(event_type: &str) -> bool {
    TOOL_EVENT_TYPES.contains(&event_type)
}

/// Sum of ITPM-consuming token fields parsed from an api_request payload.
///
/// Returns 0 when the `usage` block is missing or malformed. Matches the
/// frontend's totalTokensOf — specifically excludes `output_tokens`
/// (separate OTPM bucket) and `cache_read_input_tokens` (free for rate
/// limiting on modern Claude models).
fn itpm_tokens_of(payload: &serde_json::Value) -> u64 {
    let usage = payload.get("usage");
    let input = usage
        .and_then(|u| u.get("input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let cache_create = usage
        .and_then(|u| u.get("cache_creation_input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    input + cache_create
}

/// Aggregate a slice of events into per-session, per-bucket counts.
///
/// Events with an unparseable `received_at`, or with a timestamp below
/// `cutoff_ms`, are silently skipped. Each event is assigned to the
/// bucket whose START is `(received_at_ms / bucket_size_ms) * bucket_size_ms`
/// and whose END (the sample timestamp) is the start plus `bucket_size_ms`.
///
/// The returned vector is sorted by (session_id, bucket_end_ms) so the
/// frontend can feed samples into per-session histories in timestamp order.
pub fn aggregate_phosphor_history(
    events: &[Event],
    bucket_size_ms: i64,
    cutoff_ms: i64,
) -> Vec<PhosphorHistoryBucket> {
    if bucket_size_ms <= 0 {
        return Vec::new();
    }

    let mut accum: BTreeMap<(String, i64), (u32, u32, u32)> = BTreeMap::new();

    for event in events {
        let ts_ms = match parse_iso_ms(&event.received_at) {
            Some(t) => t,
            None => continue,
        };
        if ts_ms < cutoff_ms {
            continue;
        }
        let bucket_start = (ts_ms / bucket_size_ms) * bucket_size_ms;
        let key = (event.session_id.clone(), bucket_start);
        let entry = accum.entry(key).or_insert((0, 0, 0));
        entry.0 = entry.0.saturating_add(1);

        let event_type_str = event.event_type.to_string();
        if is_tool_call(&event_type_str) {
            entry.1 = entry.1.saturating_add(1);
        }
        if event_type_str == "api_request" {
            let tok = itpm_tokens_of(&event.payload);
            let clipped = tok.min(u32::MAX as u64) as u32;
            entry.2 = entry.2.saturating_add(clipped);
        }
    }

    accum
        .into_iter()
        .map(
            |((session_id, bucket_start), (events, toolcalls, tokens))| PhosphorHistoryBucket {
                session_id,
                bucket_end_ms: bucket_start + bucket_size_ms,
                events,
                toolcalls,
                tokens,
            },
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::EventType;
    use serde_json::json;

    fn make_event(session_id: &str, event_type: EventType, received_at: &str, payload: serde_json::Value) -> Event {
        Event {
            session_id: session_id.to_string(),
            event_type,
            payload,
            received_at: received_at.to_string(),
            provider: "claude_code".to_string(),
        }
    }

    #[test]
    fn parse_iso_ms_handles_rfc3339() {
        let ms = parse_iso_ms("2026-03-08T12:00:00Z").expect("parseable");
        // 2026-03-08T12:00:00Z → check with chrono round-trip
        let ts = chrono::DateTime::parse_from_rfc3339("2026-03-08T12:00:00Z")
            .unwrap()
            .timestamp_millis();
        assert_eq!(ms, ts);
    }

    #[test]
    fn parse_iso_ms_returns_none_for_garbage() {
        assert_eq!(parse_iso_ms("not a timestamp"), None);
        assert_eq!(parse_iso_ms(""), None);
    }

    #[test]
    fn itpm_tokens_excludes_output_and_cache_reads() {
        let payload = json!({
            "usage": {
                "input_tokens": 100,
                "output_tokens": 500,             // OTPM, excluded
                "cache_read_input_tokens": 50_000, // free for rate limits, excluded
                "cache_creation_input_tokens": 2000,
            }
        });
        assert_eq!(itpm_tokens_of(&payload), 2100);
    }

    #[test]
    fn itpm_tokens_returns_zero_for_missing_usage() {
        assert_eq!(itpm_tokens_of(&json!({})), 0);
        assert_eq!(itpm_tokens_of(&json!({"usage": {}})), 0);
        assert_eq!(itpm_tokens_of(&json!({"other": "value"})), 0);
    }

    #[test]
    fn aggregate_returns_empty_for_empty_input() {
        let out = aggregate_phosphor_history(&[], 5000, 0);
        assert!(out.is_empty());
    }

    #[test]
    fn aggregate_returns_empty_for_nonpositive_bucket_size() {
        let events = vec![make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:00Z", json!({}))];
        assert!(aggregate_phosphor_history(&events, 0, 0).is_empty());
        assert!(aggregate_phosphor_history(&events, -1, 0).is_empty());
    }

    #[test]
    fn aggregate_buckets_events_by_received_at() {
        // Three events in the same 5-second bucket, one in a later bucket.
        let e1 = make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:01Z", json!({}));
        let e2 = make_event("s1", EventType::ToolCallEnd, "2026-03-08T12:00:03Z", json!({}));
        let e3 = make_event("s1", EventType::SessionStart, "2026-03-08T12:00:04Z", json!({}));
        let e4 = make_event("s1", EventType::PromptSubmit, "2026-03-08T12:00:07Z", json!({}));

        let buckets = aggregate_phosphor_history(&[e1, e2, e3, e4], 5000, 0);
        assert_eq!(buckets.len(), 2);
        // First bucket: 3 events, 2 toolcalls
        assert_eq!(buckets[0].events, 3);
        assert_eq!(buckets[0].toolcalls, 2);
        assert_eq!(buckets[0].tokens, 0);
        // Second bucket: 1 event, 0 toolcalls
        assert_eq!(buckets[1].events, 1);
        assert_eq!(buckets[1].toolcalls, 0);
    }

    #[test]
    fn aggregate_separates_sessions() {
        let e1 = make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:01Z", json!({}));
        let e2 = make_event("s2", EventType::ToolCallStart, "2026-03-08T12:00:01Z", json!({}));
        let buckets = aggregate_phosphor_history(&[e1, e2], 5000, 0);
        assert_eq!(buckets.len(), 2);
        assert_eq!(buckets[0].session_id, "s1");
        assert_eq!(buckets[1].session_id, "s2");
        assert_eq!(buckets[0].events, 1);
        assert_eq!(buckets[1].events, 1);
    }

    #[test]
    fn aggregate_sums_itpm_tokens_across_api_requests_in_a_bucket() {
        let p1 = json!({"usage": {"input_tokens": 100, "cache_creation_input_tokens": 200}});
        let p2 = json!({"usage": {"input_tokens": 300, "cache_creation_input_tokens": 0}});
        let e1 = make_event("s1", EventType::ApiRequest, "2026-03-08T12:00:01Z", p1);
        let e2 = make_event("s1", EventType::ApiRequest, "2026-03-08T12:00:04Z", p2);
        let buckets = aggregate_phosphor_history(&[e1, e2], 5000, 0);
        assert_eq!(buckets.len(), 1);
        assert_eq!(buckets[0].tokens, 600);
    }

    #[test]
    fn aggregate_skips_events_older_than_cutoff() {
        let cutoff_iso = "2026-03-08T12:00:00Z";
        let cutoff_ms = parse_iso_ms(cutoff_iso).unwrap();
        let old = make_event("s1", EventType::ToolCallStart, "2026-03-08T11:59:59Z", json!({}));
        let fresh = make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:02Z", json!({}));
        let buckets = aggregate_phosphor_history(&[old, fresh], 5000, cutoff_ms);
        assert_eq!(buckets.len(), 1);
        assert_eq!(buckets[0].events, 1);
    }

    #[test]
    fn aggregate_skips_events_with_unparseable_received_at() {
        let good = make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:01Z", json!({}));
        let bad = make_event("s1", EventType::ToolCallStart, "garbage", json!({}));
        let buckets = aggregate_phosphor_history(&[good, bad], 5000, 0);
        assert_eq!(buckets.len(), 1);
        assert_eq!(buckets[0].events, 1);
    }

    #[test]
    fn bucket_end_is_bucket_start_plus_bucket_size() {
        let e = make_event("s1", EventType::ToolCallStart, "2026-03-08T12:00:03Z", json!({}));
        let ts_ms = parse_iso_ms("2026-03-08T12:00:03Z").unwrap();
        let expected_bucket_start = (ts_ms / 5000) * 5000;
        let buckets = aggregate_phosphor_history(&[e], 5000, 0);
        assert_eq!(buckets[0].bucket_end_ms, expected_bucket_start + 5000);
    }

    #[test]
    fn api_request_increments_tokens_not_toolcalls() {
        let payload = json!({"usage": {"input_tokens": 100, "cache_creation_input_tokens": 0}});
        let e = make_event("s1", EventType::ApiRequest, "2026-03-08T12:00:01Z", payload);
        let buckets = aggregate_phosphor_history(&[e], 5000, 0);
        assert_eq!(buckets[0].events, 1);
        assert_eq!(buckets[0].toolcalls, 0);
        assert_eq!(buckets[0].tokens, 100);
    }
}
