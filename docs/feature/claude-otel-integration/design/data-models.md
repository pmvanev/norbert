# Data Models: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23 (verified against live Claude Code v2.1.81 spike output)
**Research References**:
- `docs/research/claude-code-otel-telemetry-actual-emissions.md`
- `docs/research/otlp-json-wire-format-specification.md`
- `otel-raw-dump.jsonl` (live capture from Claude Code v2.1.81)

---

## OTLP Log Events: Input Format (from Claude Code)

Claude Code sends OTLP/HTTP JSON to `POST /v1/logs`. The payload is an `ExportLogsServiceRequest`.

### Verified Payload Structure (from live spike)

```json
{
  "resourceLogs": [{
    "resource": {
      "attributes": [
        { "key": "host.arch", "value": { "stringValue": "amd64" } },
        { "key": "os.type", "value": { "stringValue": "windows" } },
        { "key": "os.version", "value": { "stringValue": "10.0.26200" } },
        { "key": "service.name", "value": { "stringValue": "claude-code" } },
        { "key": "service.version", "value": { "stringValue": "2.1.81" } }
      ],
      "droppedAttributesCount": 0
    },
    "scopeLogs": [{
      "scope": {
        "name": "com.anthropic.claude_code.events",
        "version": "2.1.81"
      },
      "logRecords": [{
        "timeUnixNano": "1774290633104000000",
        "observedTimeUnixNano": "1774290633104000000",
        "body": { "stringValue": "claude_code.api_request" },
        "attributes": [
          { "key": "user.id", "value": { "stringValue": "186b..." } },
          { "key": "session.id", "value": { "stringValue": "6e2a8c02-aec9-4272-bcde-9843b25ad407" } },
          { "key": "organization.id", "value": { "stringValue": "6e14af6e-..." } },
          { "key": "user.email", "value": { "stringValue": "user@example.com" } },
          { "key": "user.account_uuid", "value": { "stringValue": "185bc7b6-..." } },
          { "key": "user.account_id", "value": { "stringValue": "user_0141TZ6..." } },
          { "key": "terminal.type", "value": { "stringValue": "vscode" } },
          { "key": "event.name", "value": { "stringValue": "api_request" } },
          { "key": "event.timestamp", "value": { "stringValue": "2026-03-23T18:30:33.104Z" } },
          { "key": "event.sequence", "value": { "intValue": 1 } },
          { "key": "prompt.id", "value": { "stringValue": "bacb8cf6-24af-455c-8167-2728c5700077" } },
          { "key": "model", "value": { "stringValue": "claude-opus-4-6" } },
          { "key": "input_tokens", "value": { "stringValue": "3" } },
          { "key": "output_tokens", "value": { "stringValue": "13" } },
          { "key": "cache_read_tokens", "value": { "stringValue": "0" } },
          { "key": "cache_creation_tokens", "value": { "stringValue": "22996" } },
          { "key": "cost_usd", "value": { "stringValue": "0.144065" } },
          { "key": "duration_ms", "value": { "stringValue": "2504" } },
          { "key": "speed", "value": { "stringValue": "normal" } }
        ],
        "droppedAttributesCount": 0
      }]
    }]
  }]
}
```

### CRITICAL: Attribute Value Types (Verified)

Claude Code v2.1.81 sends **all event-specific attributes as `stringValue`**, including numeric values. This contradicts the OTel spec recommendation (SHOULD use `intValue` for integers) but is spec-compliant since the spec uses SHOULD, not MUST.

| Attribute | Expected OTel Type | Actual Claude Code Type | Parser Strategy |
|-----------|-------------------|------------------------|-----------------|
| `input_tokens` | `intValue` | **`stringValue`** "337" | Parse string → i64 |
| `output_tokens` | `intValue` | **`stringValue`** "12" | Parse string → i64 |
| `cache_read_tokens` | `intValue` | **`stringValue`** "0" | Parse string → i64 |
| `cache_creation_tokens` | `intValue` | **`stringValue`** "22996" | Parse string → i64 |
| `cost_usd` | `doubleValue` | **`stringValue`** "0.144065" | Parse string → f64 |
| `duration_ms` | `intValue` | **`stringValue`** "2504" | Parse string → i64 |
| `prompt_length` | `intValue` | **`stringValue`** "5" | Parse string → i64 |
| `tool_result_size_bytes` | `intValue` | **`stringValue`** "457" | Parse string → i64 |
| `success` | `boolValue` | **`stringValue`** "true" | Parse string → bool |
| `event.sequence` | `intValue` | **`intValue`** 1 | Already integer |
| `model` | `stringValue` | `stringValue` | Pass-through |
| `speed` | `stringValue` | `stringValue` | Pass-through |

**Parser must implement a flexible extraction function** that tries, in order:
1. `stringValue` → parse to target type (string-to-int, string-to-float, string-to-bool)
2. `intValue` → use as integer (already string-encoded per OTLP spec: `"intValue": "337"`)
3. `doubleValue` → use as float (JSON number)
4. `boolValue` → use as boolean

This handles both Claude Code's current behavior AND potential future SDK changes.

### AnyValue Union (7 Variants per OTLP Spec)

The OTLP spec defines 7 possible value types in the `AnyValue` union:

| JSON Key | JSON Value Type | Rust Target | Used by Claude Code? |
|----------|----------------|-------------|---------------------|
| `stringValue` | `string` | `String` | Yes (primary for all attributes) |
| `intValue` | `string` (decimal) | `i64` (parse from string) | Yes (`event.sequence` only) |
| `doubleValue` | `number` | `f64` | Not observed |
| `boolValue` | `boolean` | `bool` | Not observed |
| `arrayValue` | `{"values": [...]}` | `Vec<AnyValue>` | Not observed |
| `kvlistValue` | `{"values": [{key,value}...]}` | `Vec<KeyValue>` | Not observed |
| `bytesValue` | `string` (base64) | `Vec<u8>` | Not observed |

For MVP, support `stringValue`, `intValue`, `doubleValue`, and `boolValue`. Log a warning for `arrayValue`, `kvlistValue`, `bytesValue` but don't fail.

### Event Name Resolution (Verified)

The event name appears in **two locations** (both confirmed in spike):
1. Log record `body.stringValue`: full qualified name (e.g., `"claude_code.api_request"`)
2. Log record attribute `event.name`: short name (e.g., `"api_request"`)

**Parser strategy**: Use `body.stringValue` for routing (more reliable, always present). Fall back to `event.name` attribute if body is not a string.

### LogRecord Fields (from OTLP spec, verified against spike)

| Field | JSON Type | Observed? | Notes |
|-------|-----------|-----------|-------|
| `timeUnixNano` | `string` (decimal nanoseconds) | Yes | `"1774290633104000000"` |
| `observedTimeUnixNano` | `string` (decimal nanoseconds) | Yes | Same as timeUnixNano |
| `severityNumber` | `number` (enum integer) | No | Not set by Claude Code |
| `severityText` | `string` | No | Not set by Claude Code |
| `body` | `AnyValue` | Yes | `{"stringValue": "claude_code.api_request"}` |
| `attributes` | `[KeyValue]` | Yes | All event data here |
| `droppedAttributesCount` | `number` | Yes | Always 0 |
| `flags` | `number` | No | Not set |
| `traceId` | `string` (hex, 32 chars) | No | Not set |
| `spanId` | `string` (hex, 16 chars) | No | Not set |

---

## Event-Specific Attributes (Verified)

### claude_code.api_request

| OTel Attribute | Verified Type | Required | Canonical Payload Field | Transform |
|----------------|--------------|----------|------------------------|-----------|
| `input_tokens` | stringValue | Yes | `usage.input_tokens` | parse → i64 |
| `output_tokens` | stringValue | Yes | `usage.output_tokens` | parse → i64 |
| `model` | stringValue | Yes | `usage.model` | pass-through |
| `cache_read_tokens` | stringValue | No (default 0) | `usage.cache_read_input_tokens` | parse → i64, **renamed** |
| `cache_creation_tokens` | stringValue | No (default 0) | `usage.cache_creation_input_tokens` | parse → i64, **renamed** |
| `cost_usd` | stringValue | No (omit if absent) | `usage.cost_usd` | parse → f64 |
| `duration_ms` | stringValue | No | `usage.duration_ms` | parse → i64 |
| `speed` | stringValue | No | `usage.speed` | pass-through |

### claude_code.user_prompt

| OTel Attribute | Verified Type | Required | Canonical Payload Field | Transform |
|----------------|--------------|----------|------------------------|-----------|
| `prompt_length` | stringValue | Yes | `prompt.prompt_length` | parse → i64 |
| `prompt` | stringValue | No | `prompt.content` | pass-through (only when `OTEL_LOG_USER_PROMPTS=1`, otherwise `<REDACTED>`) |

### claude_code.tool_result

| OTel Attribute | Verified Type | Required | Canonical Payload Field | Transform |
|----------------|--------------|----------|------------------------|-----------|
| `tool_name` | stringValue | Yes | `tool.tool_name` | pass-through |
| `success` | stringValue | No | `tool.success` | parse "true"/"false" → bool |
| `duration_ms` | stringValue | No | `tool.duration_ms` | parse → i64 |
| `error` | stringValue | No | `tool.error` | pass-through |
| `tool_result_size_bytes` | stringValue | No | `tool.result_size_bytes` | parse → i64 |
| `tool_parameters` | stringValue | No | `tool.parameters` | pass-through (JSON string) |
| `mcp_server_scope` | stringValue | No | `tool.mcp_server_scope` | pass-through |
| `decision_source` | stringValue | No | `tool.decision_source` | pass-through |
| `decision_type` | stringValue | No | `tool.decision_type` | pass-through |

### claude_code.api_error

| OTel Attribute | Verified Type | Required | Canonical Payload Field | Transform |
|----------------|--------------|----------|------------------------|-----------|
| `error` | stringValue | Yes | `error.error` | pass-through |
| `model` | stringValue | No | `error.model` | pass-through |
| `status_code` | stringValue | No | `error.status_code` | parse → i64 |
| `duration_ms` | stringValue | No | `error.duration_ms` | parse → i64 |
| `attempt` | stringValue | No | `error.attempt` | parse → i64 |
| `speed` | stringValue | No | `error.speed` | pass-through |

### claude_code.tool_decision

| OTel Attribute | Verified Type | Required | Canonical Payload Field | Transform |
|----------------|--------------|----------|------------------------|-----------|
| `tool_name` | stringValue | Yes | `decision.tool_name` | pass-through |
| `decision` | stringValue | No | `decision.decision` | pass-through (e.g., "accept", "reject") |
| `source` | stringValue | No | `decision.source` | pass-through (e.g., "config", "user_permanent") |

---

## Standard Attributes (All Event Types — Verified)

| OTel Attribute | Verified Type | Required | Maps To |
|----------------|--------------|----------|---------|
| `session.id` | stringValue | Yes | `Event.session_id` (UUID format, e.g., `"6e2a8c02-aec9-4272-bcde-9843b25ad407"`) |
| `event.name` | stringValue | Yes | Used for routing/filtering |
| `event.timestamp` | stringValue (ISO 8601) | Yes | Available for original event timestamp |
| `event.sequence` | intValue (integer) | Yes | Monotonic counter for ordering within session |
| `prompt.id` | stringValue (UUID) | No | Stored in payload for cross-event correlation |
| `user.id` | stringValue | No | Anonymous device/installation identifier |
| `organization.id` | stringValue | No | Org UUID |
| `user.email` | stringValue | No | When authenticated via OAuth |
| `user.account_uuid` | stringValue | No | Account UUID |
| `user.account_id` | stringValue | No | Tagged format (e.g., `user_0141TZ6...`) |
| `terminal.type` | stringValue | No | e.g., "vscode", "iTerm.app", "cursor" |

### Session ID Extraction (Verified)

`session.id` is a **standard attribute on log record attributes** (NOT resource attributes). Format is UUID: `"6e2a8c02-aec9-4272-bcde-9843b25ad407"`. If absent, the log record is dropped with a warning.

**Important**: Hook events use `session_id` (underscore) from the JSON body. OTel uses `session.id` (dot) from log record attributes. Both refer to the same Claude Code session identifier value. The mapper extracts `session.id` and uses its value as the internal `session_id`.

---

## OTLP Metrics: Input Format (from Claude Code)

Claude Code sends OTLP/HTTP JSON to `POST /v1/metrics`. The payload is an `ExportMetricsServiceRequest`.

### Verified Metrics Payload Structure

```json
{
  "resourceMetrics": [{
    "resource": {
      "attributes": [
        { "key": "host.arch", "value": { "stringValue": "amd64" } },
        { "key": "os.type", "value": { "stringValue": "windows" } },
        { "key": "os.version", "value": { "stringValue": "10.0.26200" } },
        { "key": "service.name", "value": { "stringValue": "claude-code" } },
        { "key": "service.version", "value": { "stringValue": "2.1.81" } }
      ],
      "droppedAttributesCount": 0
    },
    "scopeMetrics": [{
      "scope": {
        "name": "com.anthropic.claude_code",
        "version": "2.1.81"
      },
      "metrics": [
        {
          "name": "claude_code.cost.usage",
          "description": "Cost of the Claude Code session",
          "unit": "USD",
          "sum": {
            "aggregationTemporality": 1,
            "isMonotonic": true,
            "dataPoints": [{
              "attributes": [
                { "key": "session.id", "value": { "stringValue": "6e2a8c02-..." } },
                { "key": "model", "value": { "stringValue": "claude-opus-4-6[1m]" } }
              ],
              "startTimeUnixNano": "1774290634816000000",
              "timeUnixNano": "1774290637123000000",
              "asDouble": 0.144065
            }]
          }
        }
      ]
    }]
  }]
}
```

### Verified Metrics from Claude Code

All observed metrics use `sum` type with `aggregationTemporality: 1` (DELTA) and `isMonotonic: true`.

| Metric Name | Unit | Type | Key Attributes | Notes |
|-------------|------|------|---------------|-------|
| `claude_code.session.count` | count | sum/delta | standard only | Incremented at session start |
| `claude_code.cost.usage` | USD | sum/delta | `model` | Per-model cost delta |
| `claude_code.token.usage` | tokens | sum/delta | `model`, `type` | type: "input", "output", "cacheRead", "cacheCreation" |
| `claude_code.active_time.total` | s | sum/delta | `type` | type: "user" (keyboard), "cli" (tool/AI) |

**Observed metric data point values**: Always `asDouble` (never `asInt`), even for integer counts.

**Model name in metrics includes context window suffix**: `"claude-opus-4-6[1m]"` vs `"claude-opus-4-6"` in events. The parser/frontend must handle this inconsistency (strip suffix or normalize).

### Metrics Data Points

| Field | JSON Type | Notes |
|-------|-----------|-------|
| `attributes` | `[KeyValue]` | Same standard attributes as events + metric-specific |
| `startTimeUnixNano` | `string` | Start of delta window |
| `timeUnixNano` | `string` | End of delta window |
| `asDouble` | `number` | Value (always double in observed data) |
| `asInt` | `string` | Not observed but per spec, string-encoded i64 |

### Aggregation Temporality (Verified)

| Value | Name | Meaning | Claude Code Uses? |
|-------|------|---------|-------------------|
| 0 | UNSPECIFIED | Not specified | No |
| 1 | **DELTA** | Value = change since last report | **Yes (all metrics)** |
| 2 | CUMULATIVE | Value = total since start | No |

Delta temporality means each data point is an increment. To get totals, the receiver must accumulate. For Norbert's use case (real-time rate display), delta is ideal — each data point IS the rate.

---

## Canonical Event Output (to EventStore)

### ApiRequest Event

```json
{
  "session_id": "6e2a8c02-aec9-4272-bcde-9843b25ad407",
  "event_type": "api_request",
  "payload": {
    "usage": {
      "input_tokens": 3,
      "output_tokens": 13,
      "cache_read_input_tokens": 0,
      "cache_creation_input_tokens": 22996,
      "cost_usd": 0.144065,
      "model": "claude-opus-4-6",
      "duration_ms": 2504,
      "speed": "normal"
    },
    "prompt_id": "bacb8cf6-24af-455c-8167-2728c5700077",
    "event_sequence": 2
  },
  "received_at": "2026-03-23T18:30:34.817Z",
  "provider": "claude_code"
}
```

### UserPrompt Event

```json
{
  "session_id": "6e2a8c02-aec9-4272-bcde-9843b25ad407",
  "event_type": "user_prompt",
  "payload": {
    "prompt": {
      "prompt_length": 5,
      "content": "<REDACTED>"
    },
    "prompt_id": "bacb8cf6-24af-455c-8167-2728c5700077",
    "event_sequence": 0
  },
  "received_at": "2026-03-23T18:30:29.936Z",
  "provider": "claude_code"
}
```

### ToolResult Event

```json
{
  "session_id": "6e2a8c02-aec9-4272-bcde-9843b25ad407",
  "event_type": "tool_result",
  "payload": {
    "tool": {
      "tool_name": "Bash",
      "success": true,
      "duration_ms": 17903,
      "parameters": "{\"bash_command\":\"ls\",\"full_command\":\"ls -1 ...\",\"description\":\"List top-level files/dirs\"}",
      "result_size_bytes": 457,
      "decision_source": "config",
      "decision_type": "accept"
    },
    "prompt_id": "922bd4aa-3f6c-484a-bc91-defd55b5c0f7",
    "event_sequence": 6
  },
  "received_at": "2026-03-23T18:31:12.305Z",
  "provider": "claude_code"
}
```

### ApiError Event

```json
{
  "session_id": "6e2a8c02-aec9-4272-bcde-9843b25ad407",
  "event_type": "api_error",
  "payload": {
    "error": {
      "error": "rate_limit_exceeded",
      "model": "claude-sonnet-4-20250514",
      "status_code": 429,
      "duration_ms": 150,
      "attempt": 1,
      "speed": "normal"
    },
    "prompt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "event_sequence": 3
  },
  "received_at": "2026-03-23T14:30:00.300Z",
  "provider": "claude_code"
}
```

### ToolDecision Event

```json
{
  "session_id": "6e2a8c02-aec9-4272-bcde-9843b25ad407",
  "event_type": "tool_decision",
  "payload": {
    "decision": {
      "tool_name": "Bash",
      "decision": "accept",
      "source": "config"
    },
    "prompt_id": "922bd4aa-3f6c-484a-bc91-defd55b5c0f7",
    "event_sequence": 5
  },
  "received_at": "2026-03-23T18:30:54.402Z",
  "provider": "claude_code"
}
```

---

## Domain Model Change

### EventType Enum (Rust)

```
Before: SessionStart | SessionEnd | ToolCallStart | ToolCallEnd | AgentComplete | PromptSubmit
After:  SessionStart | SessionEnd | ToolCallStart | ToolCallEnd | AgentComplete | PromptSubmit
        | ApiRequest | UserPrompt | ToolResult | ApiError | ToolDecision
```

- All new variants serialize to snake_case via serde (`api_request`, `user_prompt`, `tool_result`, `api_error`, `tool_decision`)
- Display trait outputs the same snake_case strings
- None are hook events -- excluded from `HOOK_EVENT_NAMES` and `parse_event_type`

---

## Database Schema

**No schema change required.** The `events` table stores `event_type` as `TEXT`. All new event type values fit the existing schema. The `payload` column stores JSON as `TEXT`. All event payloads are valid JSON.

Existing schema (unchanged):
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,     -- "api_request", "user_prompt", etc.
    payload TEXT NOT NULL,        -- {"usage": {...}} or {"prompt": {...}} etc.
    received_at TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'unknown'
);
```

---

## OTLP HTTP Response Protocol

### Success Response

Return HTTP 200 with empty JSON body:
```
HTTP/1.1 200 OK
Content-Type: application/json

{}
```

Do NOT include `partialSuccess` field for full success (per OTLP spec).

### Error Response

Return HTTP 400 for malformed JSON:
```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error": "invalid JSON"}
```

### Response Rules (from OTLP spec)
- Response MUST use the same Content-Type as the request
- Response body for success MUST be `{}` (empty object)
- `partialSuccess` only included when rejecting some records
- Do NOT use `#[serde(deny_unknown_fields)]` in Rust — spec requires ignoring unknown fields

---

## Frontend Data Flow

### ApiRequest Events (Token/Cost Path)

The `tokenExtractor.ts` already extracts from `payload.usage.*`:

```
ApiRequest event payload:
  { usage: { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, model } }

tokenExtractor reads:
  payload.usage.input_tokens       -> inputTokens
  payload.usage.output_tokens      -> outputTokens
  payload.usage.cache_read_input_tokens -> cacheReadTokens
  payload.usage.cache_creation_input_tokens -> cacheCreationTokens
  payload.usage.model              -> model
```

This shape is already supported. The addition is `cost_usd` handling in `metricsAggregator.ts`:
- If `payload.usage.cost_usd` is a number, use it directly as `totalCost`
- Otherwise, call `calculateCost(usage, pricingTable)` as before

### Other Event Types (Non-Token Path)

UserPrompt, ToolResult, ApiError, and ToolDecision events flow through the existing event pipeline but do not carry token usage data. The `metricsAggregator.ts` dispatch table routes them:

- `user_prompt`: increment hookEventCount only (no token/cost impact)
- `tool_result`: increment hookEventCount only (enrichment data for future features)
- `api_error`: increment hookEventCount only (error visibility for future features)
- `tool_decision`: increment hookEventCount only (audit data for future features)

These events are persisted and retrievable but have no impact on the current metrics cards or oscilloscope charts. Future features can consume them via the existing `get_events_for_session` IPC query.

---

## Rust Serde Implementation Notes

### Struct Design (No `deny_unknown_fields`)

All serde structs MUST use `#[serde(default)]` on optional fields and MUST NOT use `#[serde(deny_unknown_fields)]`. The OTLP spec requires receivers to silently ignore unknown fields for forward compatibility.

### AnyValue Serde Model

```
AnyValue → Rust enum with field-tagged variants:
  StringValue(String)        → {"stringValue": "..."}
  IntValue(String)           → {"intValue": "337"}     // string in JSON!
  DoubleValue(f64)           → {"doubleValue": 0.042}  // number in JSON
  BoolValue(bool)            → {"boolValue": true}
  ArrayValue(ArrayValue)     → {"arrayValue": {"values": [...]}}
  KvlistValue(KvlistValue)   → {"kvlistValue": {"values": [...]}}
  BytesValue(String)         → {"bytesValue": "base64..."}
```

### Numeric Extraction Helper

A pure function `extract_numeric(attributes, key) -> Option<f64>`:
1. Find attribute by key
2. Try `stringValue` → parse as f64
3. Try `intValue` (string) → parse as i64 → convert to f64
4. Try `doubleValue` → use directly
5. Return None if not found or unparseable
