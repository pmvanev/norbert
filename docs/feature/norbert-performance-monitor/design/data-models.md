# Data Models: norbert-performance-monitor

## Existing Types (Reused Unchanged)

These types from `norbert-usage/domain/types.ts` are reused without modification:

| Type | Usage in PM |
|---|---|
| SessionMetrics | Per-session metrics snapshot (existing fold output) |
| RateSample | Time-series data point (timestamp, tokenRate, costRate) |
| TimeSeriesBuffer | Ring buffer for waveform rendering |
| OscilloscopeStats | Stats bar display data (peak, avg, total, window) |
| TokenUsage | Token extraction from event payloads |
| CostResult | Per-event cost computation |
| PricingTable | Model pricing rates |
| Urgency | 'normal' | 'amber' | 'red' urgency classification |

## New Domain Types

### AggregateMetrics

Cross-session aggregate computed from all active SessionMetrics. Immutable value type.

| Field | Type | Description |
|---|---|---|
| totalTokenRate | number | Sum of burnRate across all active sessions (tok/s) |
| totalCostRate | number | Sum of per-session cost rates ($/s) |
| totalActiveAgents | number | Sum of activeAgentCount across sessions |
| sessionCount | number | Count of active sessions |
| sessions | ReadonlyArray\<SessionSummary\> | Per-session summary for breakdown display |

### SessionSummary

Per-session data for the aggregate breakdown panel. Derived from SessionMetrics.

| Field | Type | Description |
|---|---|---|
| sessionId | string | Session identifier |
| tokenRate | number | Current burn rate (tok/s) |
| costRate | number | Current cost rate ($/s) |
| contextWindowPct | number | Context utilization (0-100) |
| activeAgentCount | number | Active agents in this session |
| sessionCost | number | Cumulative session cost ($) |

### TimeWindowConfig

Configuration for time window selection. Immutable value type.

| Field | Type | Description |
|---|---|---|
| durationMs | number | Window duration in milliseconds |
| label | string | Display label ("1m", "5m", "15m", "Session") |
| sampleIntervalMs | number | Target sample interval for this window |
| bufferCapacity | number | Ring buffer size for this window |

### TimeWindowId

Discriminated union for time window selection.

```
type TimeWindowId = '1m' | '5m' | '15m' | 'session'
```

### TimeWindowPreset (Const Array)

```
TIME_WINDOW_PRESETS: ReadonlyArray<TimeWindowConfig>
  1m:  { durationMs: 60000,   sampleIntervalMs: 100,  bufferCapacity: 600 }
  5m:  { durationMs: 300000,  sampleIntervalMs: 500,  bufferCapacity: 600 }
  15m: { durationMs: 900000,  sampleIntervalMs: 1000, bufferCapacity: 900 }
```

Session window has dynamic duration and resolution computed at runtime.

### MultiWindowBuffer

Collection of time-series buffers, one per window size, for a single metric source.

| Field | Type | Description |
|---|---|---|
| buffers | ReadonlyMap\<TimeWindowId, TimeSeriesBuffer\> | Buffer per window |
| activeWindow | TimeWindowId | Currently selected window |

### SessionTimeSeries

Time-series data for a single session across all window sizes.

| Field | Type | Description |
|---|---|---|
| sessionId | string | Session identifier |
| windows | MultiWindowBuffer | Buffers per time window |

### PMViewMode

Discriminated union for Performance Monitor navigation state.

```
type PMViewMode =
  | { readonly tag: 'aggregate' }
  | { readonly tag: 'session-detail'; readonly sessionId: string }
```

### CompactionEstimate

Estimated time until context compaction for a session.

| Field | Type | Description |
|---|---|---|
| estimatedMinutes | number | Estimated minutes until compaction |
| confidence | 'high' | 'low' | High if sufficient rate data; low if rate near zero |
| currentPct | number | Current context window percentage |
| remainingTokens | number | Tokens remaining before limit |

### UrgencyThresholds (Shared Configuration)

Single source of truth for urgency thresholds, consumed by PM and Gauge Cluster.

| Field | Type | Description |
|---|---|---|
| contextAmber | number | Context % amber threshold (default: 70) |
| contextRed | number | Context % red threshold (default: 90) |
| tokenRateAmber | number | Token rate amber threshold (default: 400) |
| tokenRateRed | number | Token rate red threshold (default: 500) |

This type centralizes the thresholds currently hardcoded in `gaugeCluster.ts` (`DEFAULT_THRESHOLDS`). Both PM and Gauge Cluster reference the same value.

### ChartMetric

Discriminated union identifying which metric a chart cell displays.

```
type ChartMetric = 'tokenRate' | 'costRate' | 'contextPct' | 'activeAgents'
```

### PMChartData

Pre-computed data for a single chart cell in the PM grid.

| Field | Type | Description |
|---|---|---|
| metric | ChartMetric | Which metric this chart shows |
| label | string | Display title (e.g., "tokens/s (total)") |
| currentValue | string | Formatted current value |
| waveformPoints | ReadonlyArray\<WaveformPoint\> | Canvas coordinates for waveform |
| gridLines | ReadonlyArray\<GridLine\> | Grid line positions |
| stats | OscilloscopeStats | Peak, avg, total, window stats |
| urgency | Urgency | Current urgency level |

Reuses WaveformPoint and GridLine from `oscilloscope.ts`.

### AgentMetrics

Per-agent metrics within a session (best-effort, dependent on payload data).

| Field | Type | Description |
|---|---|---|
| agentId | string | Agent identifier from event payload |
| agentRole | string | Agent role/name if available |
| tokenRate | number | Agent's current token rate (tok/s) |
| costRate | number | Agent's current cost rate ($/s) |
| tokenTotal | number | Agent's cumulative tokens |

### SessionDetailData

Pre-computed data for the session detail view.

| Field | Type | Description |
|---|---|---|
| sessionId | string | Session identifier |
| metrics | SessionMetrics | Full session metrics |
| agents | ReadonlyArray\<AgentMetrics\> | Per-agent breakdown (may be empty) |
| compaction | CompactionEstimate | Compaction time estimate |
| charts | ReadonlyArray\<PMChartData\> | Chart data for session-scoped metrics |

## SQL Queries (New)

### Load active sessions

```sql
SELECT id, started_at
FROM sessions
WHERE ended_at IS NULL
ORDER BY started_at ASC
```

### Load events for a specific session (existing, reused)

```sql
SELECT event_type, payload, received_at
FROM events
WHERE session_id = ?
ORDER BY received_at ASC
```

### Load historical samples for extended time window

```sql
SELECT event_type, payload, received_at
FROM events
WHERE session_id = ?
  AND received_at >= datetime('now', ?)
  AND event_type IN ('tool_call_end', 'prompt_submit', 'agent_complete')
ORDER BY received_at ASC
```

The `?` time offset parameter corresponds to the window size (e.g., '-5 minutes', '-15 minutes'). Historical samples are downsampled client-side to target 300-900 data points.
