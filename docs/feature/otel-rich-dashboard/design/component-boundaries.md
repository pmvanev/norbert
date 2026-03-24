# Component Boundaries: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24

---

## New Components

### 1. OTLP Metrics Parser (Rust, pure)

**Location**: `src-tauri/src/adapters/otel/` (extend existing module)
**Responsibility**: Parse `ExportMetricsServiceRequest` JSON. Traverse `resourceMetrics[].scopeMetrics[].metrics[].sum.dataPoints[]`. Extract metric name, data point attributes (session.id, model, type), and value (asDouble). Normalize model names by stripping `[...]` suffix. Return structured metric data points.
**Boundary**: Pure data transformation. No IO. Reuses existing attribute extraction helpers from log parser.
**Input**: `serde_json::Value` (raw JSON body)
**Output**: `Vec<ParsedMetricDataPoint>` with session_id, metric_name, attribute_key, value, timestamps

### 2. Model Name Normalizer (Rust, pure function)

**Location**: Within `src-tauri/src/adapters/otel/`
**Responsibility**: Strip trailing bracket suffix from model names (e.g., `claude-opus-4-6[1m]` -> `claude-opus-4-6`).
**Boundary**: Pure function. Single regex/find operation.
**Input**: `&str` model name
**Output**: `String` normalized model name

### 3. Session Enricher (Rust, pure function)

**Location**: Within `src-tauri/src/adapters/otel/`
**Responsibility**: Extract resource attributes (service.version, os.type, host.arch) from OTLP resource and standard attributes (terminal.type) from log record attributes. Produce a session metadata struct.
**Boundary**: Pure function. No IO.
**Input**: Resource attributes array + log record attributes array
**Output**: `SessionMetadata` struct

### 4. MetricStore Port (Rust, trait)

**Location**: `src-tauri/src/ports/mod.rs`
**Responsibility**: Define the driven port for metric persistence and retrieval.
**Interface**:
- `accumulate_delta(session_id, metric_name, attribute_key, delta_value)` -- upsert with addition
- `get_metrics_for_session(session_id)` -- return all accumulated metrics
- `write_session_metadata(metadata)` -- first-write-wins session enrichment
- `get_session_metadata(session_id)` -- return session enrichment data

### 5. SqliteMetricStore (Rust, adapter)

**Location**: `src-tauri/src/adapters/db/`
**Responsibility**: Implement MetricStore using SQLite. Metrics table with compound key. Upsert for delta accumulation. Session metadata table with INSERT OR IGNORE.
**Boundary**: Effect boundary (database IO). Implements the MetricStore port.

### 6. OTLP Metrics Handler (Rust, axum handler)

**Location**: `src-tauri/src/hook_receiver.rs` (new handler function)
**Responsibility**: HTTP handler for `POST /v1/metrics`. Deserializes body, delegates to metrics parser, accumulates via MetricStore, extracts session metadata.
**Boundary**: Effect boundary -- accepts HTTP, writes to database.
**Input**: HTTP POST with `application/json` body
**Output**: HTTP 200 OK `{}` or 400 Bad Request

### 7. Session Dashboard View (TypeScript/React)

**Location**: `src/plugins/norbert-usage/views/SessionDashboardView.tsx`
**Responsibility**: Layout shell for session dashboard cards. Accepts session ID, fetches events and metrics, distributes data to child cards.
**Boundary**: View boundary (React component). Composes pure domain logic with rendering.

### 8. Dashboard Card Domain Modules (TypeScript, pure)

**Location**: `src/plugins/norbert-usage/domain/` (one module per card domain)
**Responsibility**: Pure aggregation logic for each card type:
- **toolUsageAggregator**: Aggregate tool_result events by tool_name -> counts, success rates, avg durations
- **apiHealthAggregator**: Compute error rate from api_error/api_request counts, group errors by status_code
- **promptActivityAggregator**: Count user_prompt events, calculate rate and avg prompt length
- **permissionsAggregator**: Group tool_decision events by source (config/user/reject)
- **activeTimeFormatter**: Format accumulated active_time seconds into human-readable strings
- **productivityFormatter**: Format LOC/commit/PR metrics for display
**Boundary**: Pure functions. No IO, no React imports.

### 9. Dashboard Card View Components (TypeScript/React)

**Location**: `src/plugins/norbert-usage/views/` (one per card)
- `ToolUsageCard.tsx`
- `ApiHealthCard.tsx`
- `PromptActivityCard.tsx`
- `PermissionsCard.tsx`
- `ActiveTimeCard.tsx`
- `ProductivityCard.tsx`

**Responsibility**: Thin view wrappers calling pure domain aggregators, rendering results.
**Boundary**: View boundary only. All logic delegated to domain modules.

---

## Modified Components

### 10. OTLP Module (`adapters/otel/mod.rs`)

**Change**: Add metrics parsing functions alongside existing log parsing. Export shared attribute helpers for reuse. Add model name normalizer.
**Impact**: Module grows but remains pure. No behavioral change to existing log parsing.

### 11. Ports Module (`ports/mod.rs`)

**Change**: Add `MetricStore` trait with accumulation and metadata methods.
**Impact**: New trait, no changes to existing `EventStore` trait.

### 12. Hook Receiver (`hook_receiver.rs`)

**Change**: Add `POST /v1/metrics` route. Add MetricStore to AppState. Add OTLP metrics handler.
**Impact**: New route coexists with `/hooks/:type` and `/v1/logs`.

### 13. Tauri IPC Commands (`lib.rs` or equivalent)

**Change**: Add IPC commands for `get_metrics_for_session` and `get_session_metadata`.
**Impact**: New commands, no changes to existing IPC surface.

### 14. Plugin Entry (`plugins/norbert-usage/index.ts`)

**Change**: Register new Session Dashboard view. Add session-dashboard view ID and label.
**Impact**: Additive registration alongside existing views.

### 15. Metrics Aggregator (`metricsAggregator.ts`)

**Change**: Update OTel event handlers (`user_prompt`, `tool_result`, `api_error`, `tool_decision`) if any need to contribute to existing session-level metrics (e.g., tool_call_start count from tool_result).
**Impact**: Minimal -- these handlers currently return metrics unchanged.

---

## Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `tokenExtractor.ts` | Already handles api_request payload shape |
| `pricingModel.ts` | Fallback path unchanged |
| `SqliteEventStore` | Events table and event writing unchanged |
| `EventStore` trait | No interface change |
| `EventProvider` trait | Not used by OTel path |
| `OscilloscopeView.tsx` | Real-time PM unaffected |
| `GaugeClusterView.tsx` | Existing gauge unaffected |
| `PerformanceMonitorView.tsx` | Existing PM unaffected |

---

## Dependency Direction

```
hook_receiver.rs (adapter, effect boundary)
    |
    +-- uses --> otel/ parser + metrics_parser + session_enricher (adapter, pure)
    |                |
    |                +-- uses --> domain/mod.rs (EventType, Event)
    |
    +-- uses --> ports/mod.rs (EventStore, MetricStore traits)
    +-- uses --> adapters/db/ (SqliteEventStore, SqliteMetricStore)

Frontend:
    SessionDashboardView (view)
        |
        +-- uses --> toolUsageAggregator (domain, pure)
        +-- uses --> apiHealthAggregator (domain, pure)
        +-- uses --> promptActivityAggregator (domain, pure)
        +-- uses --> permissionsAggregator (domain, pure)
        +-- uses --> activeTimeFormatter (domain, pure)
        +-- uses --> productivityFormatter (domain, pure)
        |
        +-- calls --> IPC (get_events_for_session, get_metrics_for_session, get_session_metadata)
```

All dependencies point inward toward the domain. New adapters depend on the domain; the domain does not know about OTel, SQLite, or React.
