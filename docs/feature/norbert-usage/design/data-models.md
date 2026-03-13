# Data Models: norbert-usage Plugin

## Source Data: events Table (Existing)

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,      -- canonical: session_start, session_end, tool_call_start,
                                   --            tool_call_end, agent_complete, prompt_submit
    payload TEXT NOT NULL,          -- raw JSON from Claude Code hook
    received_at TEXT NOT NULL,      -- ISO 8601 timestamp
    provider TEXT NOT NULL DEFAULT 'unknown'
);
```

Indexes: `idx_events_session_id`, `idx_events_received_at`

## Source Data: sessions Table (Existing)

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    event_count INTEGER NOT NULL DEFAULT 0
);
```

## Event Payload Token Fields (Expected Structure)

Claude Code hook payloads are stored as raw JSON in the `payload` column. Token data is expected in events of type `tool_call_end`, `prompt_submit`, and `agent_complete`. The exact field paths:

```
payload.usage.input_tokens   : number | undefined
payload.usage.output_tokens  : number | undefined
payload.usage.model          : string | undefined
payload.usage.cache_read_input_tokens  : number | undefined
payload.usage.cache_creation_input_tokens : number | undefined
```

Additional fields per event type:
- `tool_call_start`: `payload.tool` (string) -- tool name
- `tool_call_end`: `payload.tool` (string) + usage fields
- `session_start`: `payload.session_id` -- session identifier
- `session_end`: may contain cumulative usage summary
- `agent_complete`: may contain agent-level usage
- `prompt_submit`: may contain response usage

**Assumption**: If `usage` fields are absent from an event, the event contributes to non-token metrics only (tool call count, agent tracking, timing). No exception is thrown; no false zero is injected.

## Domain Types (Algebraic Data Types)

### TokenUsage

Extracted from a single event payload. Immutable value type.

| Field | Type | Description |
|---|---|---|
| inputTokens | number | Input tokens consumed |
| outputTokens | number | Output tokens generated |
| cacheReadTokens | number | Cache-read input tokens (0 if absent) |
| cacheCreationTokens | number | Cache-creation input tokens (0 if absent) |
| model | string | Model identifier (e.g., "claude-opus-4-20250514") |

Discriminated union: `TokenExtractionResult = { tag: 'found', usage: TokenUsage } | { tag: 'absent' }`

### ModelPricing

Per-model pricing rate. Immutable configuration data.

| Field | Type | Description |
|---|---|---|
| modelPattern | string | Model ID prefix or glob (e.g., "claude-opus-4", "claude-sonnet-4") |
| inputRate | number | Cost per 1K input tokens in USD |
| outputRate | number | Cost per 1K output tokens in USD |
| cacheReadRate | number | Cost per 1K cache-read tokens in USD |
| cacheCreationRate | number | Cost per 1K cache-creation tokens in USD |

### PricingTable

Ordered list of ModelPricing entries. First match wins. Final entry is a fallback with conservative pricing.

Default pricing (as of 2025-Q4, Anthropic published rates):

| Model Pattern | Input/1K | Output/1K | Cache Read/1K | Cache Create/1K |
|---|---|---|---|---|
| claude-opus-4 | $0.015 | $0.075 | $0.0015 | $0.01875 |
| claude-sonnet-4 | $0.003 | $0.015 | $0.0003 | $0.00375 |
| claude-haiku | $0.0008 | $0.004 | $0.00008 | $0.001 |
| (fallback) | $0.015 | $0.075 | $0.0015 | $0.01875 |

### CostResult

Output of pricing computation for a single event.

| Field | Type | Description |
|---|---|---|
| totalCost | number | Total cost for this event in USD |
| inputCost | number | Input token cost |
| outputCost | number | Output token cost |
| cacheCost | number | Cache-related cost (read + creation) |
| model | string | Model used for pricing lookup |

### SessionMetrics

Accumulated metrics for a single session. Immutable snapshot replaced on each update.

| Field | Type | Description |
|---|---|---|
| sessionId | string | Session identifier |
| totalTokens | number | Sum of all input + output tokens |
| inputTokens | number | Total input tokens |
| outputTokens | number | Total output tokens |
| sessionCost | number | Cumulative session cost in USD |
| toolCallCount | number | Count of tool_call_start events |
| activeAgentCount | number | session_start events minus agent_complete events |
| contextWindowPct | number | Current context utilization (0-100) |
| contextWindowModel | string | Model whose context limit is being tracked |
| hookEventCount | number | Total events received |
| sessionStartedAt | string | ISO 8601 session start timestamp |
| lastEventAt | string | ISO 8601 most recent event timestamp |
| burnRate | number | Current tokens/second over rolling window |

### RateSample

A single point in the oscilloscope time-series.

| Field | Type | Description |
|---|---|---|
| timestamp | number | Unix milliseconds |
| tokenRate | number | Tokens per second at this sample |
| costRate | number | USD per second at this sample |

### TimeSeriesBuffer

Ring buffer for oscilloscope waveform data.

| Field | Type | Description |
|---|---|---|
| samples | ReadonlyArray\<RateSample\> | Fixed-capacity array (max 600) |
| capacity | number | Maximum samples (600 = 60s at 10Hz) |
| headIndex | number | Index of newest sample |

### OscilloscopeStats

Summary statistics derived from the time-series buffer.

| Field | Type | Description |
|---|---|---|
| peakRate | number | Maximum token rate in window |
| avgRate | number | Mean token rate in window |
| totalTokens | number | Sum of tokens in window |
| windowDuration | number | Window size in seconds |

### DailyCostEntry

Single day in the 7-day burn chart.

| Field | Type | Description |
|---|---|---|
| date | string | ISO date (YYYY-MM-DD) |
| totalCost | number | Sum of all session costs for the day |
| sessionCount | number | Number of sessions that day |

### MetricCardData

Data model for a single metric card in the Usage Dashboard.

| Field | Type | Description |
|---|---|---|
| label | string | Display label (e.g., "Running Cost") |
| value | string | Formatted primary value (e.g., "$2.30") |
| subtitle | string | Secondary text (e.g., "+12c last 60s") |
| urgency | 'normal' \| 'amber' \| 'red' | Visual urgency zone |

## Context Window Calculation

Context window percentage requires knowing the model's maximum context size:

| Model Pattern | Context Limit |
|---|---|
| claude-opus-4 | 200,000 tokens |
| claude-sonnet-4 | 200,000 tokens |
| claude-haiku | 200,000 tokens |
| (fallback) | 200,000 tokens |

Calculation: `contextWindowPct = (totalTokensInContext / contextLimit) * 100`

Note: "tokens in context" is the cumulative input tokens for the current conversation turn, not total session tokens. This is approximated from the most recent event's token count where available. Exact context usage tracking depends on Claude Code providing this in the payload.

## SQL Queries (Plugin reads via api.db.execute)

### Load events for a session
```sql
SELECT event_type, payload, received_at
FROM events
WHERE session_id = ?
ORDER BY received_at ASC
```

### Load 7-day cost history
```sql
SELECT date(received_at) as day, payload
FROM events
WHERE received_at >= date('now', '-7 days')
  AND event_type IN ('tool_call_end', 'prompt_submit', 'agent_complete')
ORDER BY received_at ASC
```

Note: Cost is computed client-side from payload token data, not stored in SQLite. This avoids schema changes and keeps the events table as a pure append-only event log.
