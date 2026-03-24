# Architecture Design: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Architect**: Morgan (solution-architect)
**Predecessor**: claude-otel-integration (completed)

---

## System Context

Norbert is a local-first desktop observability app for Claude Code. The predecessor feature established `/v1/logs` ingestion with 5 event types. This feature adds `/v1/metrics` ingestion, enriches sessions with metadata, and surfaces all event/metric data through dashboard cards.

### C4 Level 1: System Context

```mermaid
C4Context
    title System Context: Norbert OTel Rich Dashboard

    Person(dev, "Developer", "Runs Claude Code sessions, monitors usage in Norbert")

    System(norbert, "Norbert Desktop App", "Local-first observability with rich session dashboard")
    System_Ext(claude_code, "Claude Code", "AI coding assistant emitting OTel logs/events and metrics")
    System_Ext(anthropic_api, "Anthropic API", "LLM API returning token usage and cost")

    Rel(dev, norbert, "Views session dashboard with 7 cards")
    Rel(dev, claude_code, "Uses for coding tasks")
    Rel(claude_code, anthropic_api, "Calls for completions")
    Rel(claude_code, norbert, "Sends OTel logs via POST /v1/logs")
    Rel(claude_code, norbert, "Sends OTel metrics via POST /v1/metrics")
```

### C4 Level 2: Container Diagram

```mermaid
C4Container
    title Container Diagram: Norbert with Rich Dashboard

    Person(dev, "Developer")

    Container_Boundary(norbert, "Norbert Desktop App") {
        Container(frontend, "React Frontend", "TypeScript/React", "Plugin views: PM, dashboard cards, session list with enrichment")
        Container(tauri_core, "Tauri Core", "Rust", "IPC bridge, window management, tray icon")
        Container(hook_receiver, "Hook Receiver", "Rust/axum", "HTTP server on 127.0.0.1:3748 accepting hooks, OTLP logs, and OTLP metrics")
        ContainerDb(sqlite, "SQLite Database", "SQLite + WAL", "Events, sessions, and metrics storage")
    }

    System_Ext(claude_code, "Claude Code")

    Rel(dev, frontend, "Views via Tauri webview")
    Rel(claude_code, hook_receiver, "POSTs hook events to /hooks/:type")
    Rel(claude_code, hook_receiver, "POSTs OTLP logs to /v1/logs")
    Rel(claude_code, hook_receiver, "POSTs OTLP metrics to /v1/metrics")
    Rel(hook_receiver, sqlite, "Writes events and metrics via EventStore/MetricStore")
    Rel(tauri_core, sqlite, "Reads events, metrics, and sessions via ports")
    Rel(frontend, tauri_core, "Queries via IPC commands")
```

### C4 Level 3: Component Diagram (Hook Receiver with Metrics)

```mermaid
C4Component
    title Component Diagram: Hook Receiver with Metrics Ingestion

    Container_Boundary(hook_receiver, "Hook Receiver (axum)") {
        Component(router, "Axum Router", "Route dispatcher", "Routes /hooks/:type, /v1/logs, /v1/metrics")
        Component(hook_handler, "Hook Handler", "Existing", "Extracts session_id, delegates to EventProvider")
        Component(otlp_log_handler, "OTLP Log Handler", "Existing", "Parses ExportLogsServiceRequest, routes by event.name")
        Component(otlp_metrics_handler, "OTLP Metrics Handler", "New", "Parses ExportMetricsServiceRequest, extracts data points")
        Component(otlp_log_parser, "OTLP Log Parser", "Existing pure module", "Parses log records, extracts attributes")
        Component(otlp_metrics_parser, "OTLP Metrics Parser", "New pure module", "Parses metric data points, normalizes model names")
        Component(session_enricher, "Session Enricher", "New pure function", "Extracts resource/standard attrs for session metadata")
        Component(event_store, "SqliteEventStore", "Existing", "Persists events and manages sessions")
        Component(metric_store, "SqliteMetricStore", "New", "Persists accumulated metric data points")
    }

    Rel(router, hook_handler, "Dispatches /hooks/:type")
    Rel(router, otlp_log_handler, "Dispatches /v1/logs")
    Rel(router, otlp_metrics_handler, "Dispatches /v1/metrics")
    Rel(otlp_log_handler, otlp_log_parser, "Parses OTLP JSON body")
    Rel(otlp_log_handler, session_enricher, "Extracts resource/standard attrs")
    Rel(otlp_metrics_handler, otlp_metrics_parser, "Parses metric data points")
    Rel(otlp_metrics_parser, session_enricher, "Extracts resource attrs from metric payload")
    Rel(otlp_log_handler, event_store, "Writes typed events")
    Rel(otlp_metrics_handler, metric_store, "Writes accumulated metrics")
```

### C4 Level 3: Component Diagram (Frontend Dashboard)

```mermaid
C4Component
    title Component Diagram: Frontend Session Dashboard

    Container_Boundary(frontend, "React Frontend") {
        Component(session_list, "Session List View", "Existing + enrichment", "Lists sessions with IDE badges, version, platform")
        Component(dashboard_shell, "Session Dashboard Shell", "New", "Layout container for dashboard cards")
        Component(tool_card, "Tool Usage Card", "New", "Aggregates tool_result events by tool name")
        Component(api_health_card, "API Health Card", "New", "Computes error rate from api_error/api_request events")
        Component(prompt_card, "Prompt Activity Card", "New", "Counts user_prompt events, calculates rate")
        Component(permissions_card, "Permissions Card", "New", "Aggregates tool_decision events by source")
        Component(active_time_card, "Active Time Card", "New", "Displays user/CLI time from accumulated metrics")
        Component(productivity_card, "Productivity Card", "New", "Shows LOC, commits, PRs from accumulated metrics")
        Component(event_query, "Event Query Layer", "New", "Fetches session events by type via IPC")
        Component(metric_query, "Metric Query Layer", "New", "Fetches accumulated metrics via IPC")
    }

    Rel(session_list, dashboard_shell, "Navigates to session dashboard on select")
    Rel(dashboard_shell, tool_card, "Renders card")
    Rel(dashboard_shell, api_health_card, "Renders card")
    Rel(dashboard_shell, prompt_card, "Renders card")
    Rel(dashboard_shell, permissions_card, "Renders card")
    Rel(dashboard_shell, active_time_card, "Renders card")
    Rel(dashboard_shell, productivity_card, "Renders card")
    Rel(tool_card, event_query, "Fetches tool_result events")
    Rel(api_health_card, event_query, "Fetches api_error + api_request events")
    Rel(prompt_card, event_query, "Fetches user_prompt events")
    Rel(permissions_card, event_query, "Fetches tool_decision events")
    Rel(active_time_card, metric_query, "Fetches accumulated active_time metrics")
    Rel(productivity_card, metric_query, "Fetches accumulated LOC/commit/PR metrics")
```

---

## Architecture Approach

**Style**: Modular monolith with ports-and-adapters (existing). Extends the existing architecture with a new ingestion route, new storage port, and new frontend views.

**Justification**: Solo developer, sub-second latency requirement, existing infrastructure. Adding `/v1/metrics` to the existing axum server and new cards to the existing plugin system is the simplest viable approach. See ADR-035.

### Rejected Simpler Alternatives

1. **Frontend-only with existing events**: Display only the 4 non-api_request event types that are already persisted. Impact: ~40% of problem solved. Why insufficient: misses all `/v1/metrics` data (active time, productivity, git activity, cost supplementation) which covers 3 of the top 6 job stories by opportunity score.

2. **Metrics as synthetic events**: Store metric data points as regular events in the existing events table (event_type = "metric_cost_usage" etc). Impact: 90% of problem solved with no schema change. Why insufficient: metric data points have fundamentally different shape (delta accumulation, model+type compound keys, no prompt.id). Querying accumulated totals would require scanning and summing all synthetic events on every frontend render, degrading performance for sessions with 60+ metric exports.

---

## Key Design Decisions

### 1. Dedicated Metrics Table (ADR-035)

Metric data points stored in a dedicated `metrics` table, not as synthetic events. Schema designed for accumulated totals with compound key (session_id, metric_name, attribute_key). Backend accumulates deltas on write, so reads return current totals without computation.

### 2. Backend Delta Accumulation (ADR-036)

Accumulate delta values in the backend (SQLite upsert) rather than frontend. Running totals persisted to database survive page refreshes and app restarts. Frontend reads pre-accumulated values.

### 3. Session Metadata Enrichment via Separate Table (ADR-037)

Resource attributes (service.version, os.type, host.arch) and standard attributes (terminal.type) stored in a `session_metadata` table. Extracted from first OTLP payload per session. Queried by frontend for session list enrichment.

### 4. Model Name Normalization at Ingestion (ADR-038)

Strip trailing `[...]` suffix from model names in metric data points during parsing. Applied in the OTLP metrics parser (pure function). Events already arrive without suffix, so no change to log parser.

### 5. Dashboard Cards as New Plugin Views

Dashboard cards register as a new view in the existing norbert-usage plugin (not a new plugin). The session dashboard is a new view alongside the existing Performance Monitor, Gauge Cluster, and Usage Dashboard views.

### 6. OTel Metrics Parser Reuses Existing Infrastructure

The metrics parser reuses the existing `find_attribute`, `get_string_attribute`, `get_f64_attribute` helpers from the OTel log parser module. Shared extraction utilities, separate envelope parsing.

---

## Data Flow

### Metrics Ingestion Flow

```
Claude Code session active
    |
    +-- Every 60s: POST /v1/metrics (ExportMetricsServiceRequest)
    |                    |
    |                    v
    |              otlp_metrics_handler (axum)
    |                    |
    |              Parse ExportMetricsServiceRequest
    |              Traverse resourceMetrics[].scopeMetrics[].metrics[].sum.dataPoints[]
    |              For each data point:
    |                Extract session.id from data point attributes
    |                Extract metric name from parent metric
    |                Normalize model name (strip [1m] suffix)
    |                Build compound key (session_id, metric_name, attribute_key)
    |                    |
    |                    v
    |              MetricStore.accumulate_delta()
    |                    |
    |                    v
    |              SQLite: UPSERT metrics SET value = value + delta
    |
    +-- Also extract resource attributes on first payload per session:
         service.version, os.type, host.arch -> session_metadata table
```

### Session Enrichment Flow

```
First OTLP payload for session (log or metric)
    |
    v
Extract resource attributes:
    service.version, os.type, host.arch
Extract standard attributes (from log records):
    terminal.type
    |
    v
SessionMetadata { session_id, terminal_type, service_version, os_type, host_arch }
    |
    v
session_metadata table (INSERT OR IGNORE -- first-write wins)
    |
    v
Frontend: IPC get_session_metadata(session_id) -> badges + version + platform
```

### Dashboard Card Data Flow

```
Frontend selects session
    |
    +-- IPC: get_events_for_session(session_id) -> all events
    |       |
    |       +-- Filter by event_type in frontend:
    |           tool_result    -> Tool Usage card (aggregate by tool_name)
    |           api_error      -> API Health card (compute error rate)
    |           api_request    -> API Health denominator + Cost card (existing)
    |           user_prompt    -> Prompt Activity card (count, rate, avg length)
    |           tool_decision  -> Permissions card (group by source)
    |
    +-- IPC: get_metrics_for_session(session_id) -> accumulated metrics
            |
            +-- active_time.total (type=user, type=cli) -> Active Time card
            +-- lines_of_code.count (type=added, type=removed) -> Productivity card
            +-- commit.count -> Productivity card
            +-- pull_request.count -> Productivity card
            +-- cost.usage -> Cost supplementation (cross-validation)
            +-- token.usage -> Token supplementation
```

---

## Quality Attribute Strategies

| Attribute | Strategy | Measurable Target |
|-----------|----------|-------------------|
| **Latency** | Backend accumulation (no scan-and-sum); single IPC call returns pre-computed totals | <200ms dashboard load for 500+ events |
| **Correctness** | Delta accumulation via atomic upsert; model name normalization at ingestion | Metric totals match Claude Code's cumulative counters |
| **Maintainability** | Pure parser modules; each card is an independent component with own domain logic | New card addable without modifying existing cards |
| **Testability** | Metrics parser is pure (no IO); card domain logic is pure (aggregation functions) | All aggregation logic testable without HTTP/DB |
| **Backward Compatibility** | New routes and tables are additive; existing /v1/logs and events table unchanged | Zero regression for existing users |

---

## Deployment Architecture

No change. The new `/v1/metrics` route is added to the same axum router on the same port (3748). No new processes, ports, or configuration files.

User enablement: The existing norbert-cc-plugin already sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748`. To enable metrics export, add:
```
OTEL_METRICS_EXPORTER=otlp
```
This is an additive configuration change. If not set, metric-dependent cards show "No data" with guidance.
