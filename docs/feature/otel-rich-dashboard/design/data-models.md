# Data Models: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Predecessor Reference**: `docs/feature/claude-otel-integration/design/data-models.md`

---

## OTLP Metrics: Input Format (from Claude Code)

Verified payload structure from predecessor research. See `docs/feature/claude-otel-integration/design/data-models.md` for full ExportMetricsServiceRequest format.

### Metric Data Point Extraction

For each metric in `resourceMetrics[].scopeMetrics[].metrics[]`:

| Field | Source | Notes |
|-------|--------|-------|
| metric_name | `metrics[i].name` | e.g., `claude_code.cost.usage` |
| session_id | `dataPoints[j].attributes` key `session.id` | UUID, same as log events |
| value | `dataPoints[j].asDouble` | Always double (verified) |
| attribute_key | Compound from data point attributes | See below |
| start_time | `dataPoints[j].startTimeUnixNano` | Delta window start |
| end_time | `dataPoints[j].timeUnixNano` | Delta window end |

### Compound Attribute Key Construction

Each metric data point's identity is determined by its non-session attributes:

| Metric | Discriminating Attributes | Attribute Key Example |
|--------|--------------------------|----------------------|
| `session.count` | (none) | `""` |
| `cost.usage` | `model` | `model=claude-opus-4-6` |
| `token.usage` | `model`, `type` | `model=claude-opus-4-6,type=input` |
| `active_time.total` | `type` | `type=user` |
| `lines_of_code.count` | `type` | `type=added` |
| `commit.count` | (none) | `""` |
| `pull_request.count` | (none) | `""` |
| `code_edit_tool.decision` | `tool_name`, `decision`, `source`, `language` | `tool_name=Bash,decision=accept,source=config,language=` |

### Model Name Normalization

Metrics model attribute includes context window suffix. Normalization strips it:

| Input | Output |
|-------|--------|
| `claude-opus-4-6[1m]` | `claude-opus-4-6` |
| `claude-sonnet-4-20250514[200k]` | `claude-sonnet-4-20250514` |
| `claude-opus-4-6` (no suffix) | `claude-opus-4-6` (unchanged) |

Pattern: strip trailing `\[.*\]` from model attribute value.
Applied at: metrics parser (backend), before storage.

---

## Database Schema Extensions

### Metrics Table (New)

```sql
CREATE TABLE IF NOT EXISTS metrics (
    session_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    attribute_key TEXT NOT NULL DEFAULT '',
    value REAL NOT NULL DEFAULT 0.0,
    last_updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, metric_name, attribute_key)
);

CREATE INDEX IF NOT EXISTS idx_metrics_session_id
    ON metrics (session_id);
```

- Compound primary key enables atomic upsert: `INSERT ... ON CONFLICT DO UPDATE SET value = value + excluded.value`
- `value` stores the accumulated total (backend sums deltas on write)
- `attribute_key` is a canonical string built from sorted non-session attributes
- `last_updated_at` tracks most recent delta for staleness detection

### Session Metadata Table (New)

```sql
CREATE TABLE IF NOT EXISTS session_metadata (
    session_id TEXT PRIMARY KEY,
    terminal_type TEXT,
    service_version TEXT,
    os_type TEXT,
    host_arch TEXT,
    created_at TEXT NOT NULL
);
```

- Populated on first OTLP payload per session (INSERT OR IGNORE)
- All columns nullable (graceful degradation when attributes missing)
- `terminal_type` from standard attribute `terminal.type` on log records
- `service_version` from resource attribute `service.version`
- `os_type` from resource attribute `os.type`
- `host_arch` from resource attribute `host.arch`

---

## Rust Domain Types

### ParsedMetricDataPoint

Produced by the OTLP metrics parser (pure):

```
ParsedMetricDataPoint {
    session_id: String,        // from data point attributes
    metric_name: String,       // from parent metric.name (stripped prefix)
    attribute_key: String,     // compound key from non-session attributes
    value: f64,                // from asDouble
    start_time_nano: String,   // delta window start
    end_time_nano: String,     // delta window end
}
```

### SessionMetadata

Produced by the session enricher (pure):

```
SessionMetadata {
    session_id: String,
    terminal_type: Option<String>,
    service_version: Option<String>,
    os_type: Option<String>,
    host_arch: Option<String>,
}
```

---

## Frontend Types

### AccumulatedMetric

Returned by IPC `get_metrics_for_session`:

```typescript
interface AccumulatedMetric {
    readonly metricName: string;
    readonly attributeKey: string;
    readonly value: number;
}
```

### SessionMetadata

Returned by IPC `get_session_metadata`:

```typescript
interface SessionMetadataDTO {
    readonly sessionId: string;
    readonly terminalType: string | null;
    readonly serviceVersion: string | null;
    readonly osType: string | null;
    readonly hostArch: string | null;
}
```

### Card Aggregation Types

Each card domain module produces a typed result:

```typescript
// Tool Usage
interface ToolUsageSummary {
    readonly totalCalls: number;
    readonly uniqueTools: number;
    readonly overallSuccessRate: number;
    readonly tools: ReadonlyArray<ToolBreakdown>;
}
interface ToolBreakdown {
    readonly toolName: string;
    readonly callCount: number;
    readonly successRate: number;
    readonly avgDurationMs: number;
    readonly failures: ReadonlyArray<ToolFailure>;
}

// API Health
interface ApiHealthSummary {
    readonly totalRequests: number;
    readonly totalErrors: number;
    readonly errorRate: number;
    readonly errorsByStatusCode: ReadonlyArray<ErrorGroup>;
}

// Prompt Activity
interface PromptActivitySummary {
    readonly promptCount: number;
    readonly promptsPerMinute: number;
    readonly avgPromptLength: number;
}

// Permissions
interface PermissionsSummary {
    readonly totalDecisions: number;
    readonly autoApproved: number;
    readonly userApproved: number;
    readonly rejected: number;
    readonly perTool: ReadonlyArray<ToolPermissionBreakdown>;
}

// Active Time
interface ActiveTimeSummary {
    readonly userSeconds: number;
    readonly cliSeconds: number;
    readonly totalSeconds: number;
    readonly userFormatted: string;
    readonly cliFormatted: string;
}

// Productivity
interface ProductivitySummary {
    readonly linesAdded: number;
    readonly linesRemoved: number;
    readonly netChange: number;
    readonly commitCount: number;
    readonly prCount: number;
}
```

---

## IPC Commands (New)

| Command | Input | Output | Notes |
|---------|-------|--------|-------|
| `get_metrics_for_session` | `session_id: string` | `AccumulatedMetric[]` | All accumulated metrics for session |
| `get_session_metadata` | `session_id: string` | `SessionMetadataDTO \| null` | Session enrichment data |
| `get_all_session_metadata` | (none) | `SessionMetadataDTO[]` | For session list enrichment |

Existing `get_events_for_session` already returns all events; frontend filters by event_type.

---

## Terminal Type Badge Mapping

| `terminal.type` Value | Display Badge |
|----------------------|---------------|
| `vscode` | VS Code |
| `cursor` | Cursor |
| `iTerm.app` | iTerm |
| `tmux` | tmux |
| `xterm` | xterm |
| (missing/unknown) | (no badge) |

Badge mapping is a pure function in the frontend. Unknown values show no badge, not an error.

---

## Cost Data Consistency

Two data sources provide cost information:
1. **Primary**: `cost_usd` attribute on `api_request` events (per-request granularity)
2. **Supplementary**: `claude_code.cost.usage` accumulated metric (per-model total)

**Rule**: Frontend uses event-sourced cost as the authoritative value. Metric cost is for cross-validation or when event data is incomplete. Frontend MUST NOT sum both sources -- that would double-count.

**Error Handling**: Metric accumulation failures (SQLite write errors) follow the existing hook_receiver pattern: log warning via eprintln, continue processing remaining data points, return HTTP 200. Partial success is acceptable (data point can be re-accumulated on next export interval).
