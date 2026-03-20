# Data Models: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-20

---

## OTLP Input Format (from Claude Code)

Claude Code sends OTLP/HTTP JSON to `POST /v1/traces`. The relevant subset:

```json
{
  "resourceSpans": [{
    "resource": {
      "attributes": [
        { "key": "session_id", "value": { "stringValue": "sess-abc-123" } }
      ]
    },
    "scopeSpans": [{
      "spans": [{
        "name": "claude_code.api_request",
        "attributes": [
          { "key": "input_tokens", "value": { "intValue": "1500" } },
          { "key": "output_tokens", "value": { "intValue": "800" } },
          { "key": "cache_read_tokens", "value": { "intValue": "500" } },
          { "key": "cache_creation_tokens", "value": { "intValue": "200" } },
          { "key": "cost_usd", "value": { "doubleValue": 0.042 } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4-20250514" } }
        ]
      }]
    }]
  }]
}
```

### OTLP Attribute Value Types

OTel attributes use typed value wrappers:
- `intValue`: string-encoded integer (e.g., `"1500"`)
- `doubleValue`: JSON number (e.g., `0.042`)
- `stringValue`: string (e.g., `"claude-sonnet-4-20250514"`)

The parser must handle `intValue` as string-to-integer conversion.

---

## Canonical Event Output (to EventStore)

The OTLP handler produces standard `Event` structs:

```json
{
  "session_id": "sess-abc-123",
  "event_type": "api_request",
  "payload": {
    "usage": {
      "input_tokens": 1500,
      "output_tokens": 800,
      "cache_read_input_tokens": 500,
      "cache_creation_input_tokens": 200,
      "cost_usd": 0.042,
      "model": "claude-sonnet-4-20250514"
    }
  },
  "received_at": "2026-03-20T14:30:00.123Z",
  "provider": "claude_code"
}
```

### Field Mapping Table

| OTel Span Attribute | Canonical Payload Field | Transform |
|---------------------|------------------------|-----------|
| `input_tokens` (intValue) | `usage.input_tokens` | string -> integer |
| `output_tokens` (intValue) | `usage.output_tokens` | string -> integer |
| `cache_read_tokens` (intValue) | `usage.cache_read_input_tokens` | string -> integer, **renamed** |
| `cache_creation_tokens` (intValue) | `usage.cache_creation_input_tokens` | string -> integer, **renamed** |
| `cost_usd` (doubleValue) | `usage.cost_usd` | pass-through |
| `model` (stringValue) | `usage.model` | pass-through |

### Required vs Optional Attributes

| Attribute | Required? | Behavior When Missing |
|-----------|-----------|----------------------|
| `input_tokens` | Yes | Drop span, log warning |
| `output_tokens` | Yes | Drop span, log warning |
| `model` | Yes | Drop span, log warning |
| `cache_read_tokens` | No | Default to 0 |
| `cache_creation_tokens` | No | Default to 0 |
| `cost_usd` | No | Omit from payload (frontend falls back to pricing model) |

### Session ID Extraction

Checked in order:
1. Span attributes: look for `session_id` key
2. Resource attributes: look for `session_id` key
3. If neither found: drop span, log warning

---

## Domain Model Change

### EventType Enum (Rust)

```
Before: SessionStart | SessionEnd | ToolCallStart | ToolCallEnd | AgentComplete | PromptSubmit
After:  SessionStart | SessionEnd | ToolCallStart | ToolCallEnd | AgentComplete | PromptSubmit | ApiRequest
```

- Serializes to `"api_request"` (snake_case via serde)
- Display trait outputs `"api_request"`
- NOT a hook event -- excluded from `HOOK_EVENT_NAMES` and `parse_event_type`

---

## Database Schema

**No schema change required.** The `events` table stores `event_type` as `TEXT`. The value `"api_request"` fits the existing schema. The `payload` column stores JSON as `TEXT`. The usage payload is valid JSON.

Existing schema (unchanged):
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,     -- "api_request" stored here
    payload TEXT NOT NULL,        -- {"usage": {...}} stored here
    received_at TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'unknown'
);
```

---

## Frontend Data Flow

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

This shape is already supported. The only addition is `cost_usd` in `metricsAggregator.ts`:
- If `payload.usage.cost_usd` is a number, use it directly as `totalCost`
- Otherwise, call `calculateCost(usage, pricingTable)` as before
