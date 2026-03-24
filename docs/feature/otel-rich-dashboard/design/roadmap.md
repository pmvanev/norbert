# Roadmap: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Paradigm**: Functional programming
**Estimated production files**: ~18 (6 backend + 12 frontend)
**Steps**: 8 (ratio: 8/18 = 0.44 -- well within 2.5 limit)

---

## Rejected Simple Alternatives

### Alternative 1: Display Existing Event Data Only (No Metrics)
- **What**: Build dashboard cards using only the 4 non-api_request event types already persisted
- **Expected Impact**: ~40% of problem solved (tool usage, API health, prompts, permissions)
- **Why Insufficient**: Misses metrics ingestion entirely. Active time, productivity, git activity (3 of top 6 job stories by opportunity score) require `/v1/metrics` data that is currently silently dropped.

### Alternative 2: Metrics Logging Without UI
- **What**: Add `/v1/metrics` handler that logs payloads to console but builds no storage or UI
- **Expected Impact**: ~10% -- data captured in logs but not actionable
- **Why Insufficient**: Solves "no data loss" but provides zero visibility. All 7 job stories require UI surfaces.

### Why Full Solution Necessary
1. Simple alternatives miss metrics ingestion (JS-6, score 16.0) and productivity tracking (JS-5, score 16.0)
2. Full solution addresses all 7 job stories with pre-computed backend storage and dedicated UI cards

---

## Dependency Order

```
Phase 01: Backend Infrastructure (metrics storage + enrichment)
    |
    +-- Phase 02: Metrics Ingestion + Model Normalization
    |       |
    |       +-- Phase 03: Event-Based Cards (tool, API, prompt, permissions)
    |       |
    |       +-- Phase 04: Metric-Based Cards (active time, productivity)
    |
    +-- Phase 02 also: Session Metadata Enrichment
            |
            +-- Phase 03: Session List Enrichment UI
```

---

## Phase 01: Backend Infrastructure

### Step 01-01: MetricStore Port and SQLite Adapter

**Description**: Define MetricStore driven port with delta accumulation and session metadata. Implement SQLite adapter with metrics and session_metadata tables.

**Acceptance Criteria**:
- MetricStore trait defines accumulate_delta and get_metrics_for_session
- MetricStore trait defines write_session_metadata and get_session_metadata
- SQLite adapter creates metrics table with compound primary key
- SQLite adapter creates session_metadata table
- Upsert accumulation adds delta to existing value atomically

**Architectural Constraints**:
- Metrics table: PRIMARY KEY (session_id, metric_name, attribute_key)
- Session metadata: INSERT OR IGNORE (first-write-wins)
- Pure port trait in ports/mod.rs, adapter in adapters/db/

---

## Phase 02: Ingestion and Enrichment

### Step 02-01: OTLP Metrics Parser and Model Normalizer

**Description**: Parse ExportMetricsServiceRequest payloads. Extract metric name, data point attributes, session.id, and value. Normalize model names by stripping bracket suffix.

**Acceptance Criteria**:
- Parser traverses resourceMetrics/scopeMetrics/metrics/dataPoints hierarchy
- session.id extracted from data point attributes
- Model name suffix `[...]` stripped before output
- Data points without session.id dropped with warning
- Parser is pure (no IO)

**Architectural Constraints**:
- Reuse existing attribute extraction helpers from OTel log parser
- Model normalizer is a separate pure function
- Output: Vec of ParsedMetricDataPoint values

### Step 02-02: OTLP Metrics HTTP Handler

**Description**: Add POST /v1/metrics route to axum router. Parse body, delegate to metrics parser, accumulate via MetricStore. Extract resource attributes for session enrichment.

**Acceptance Criteria**:
- POST /v1/metrics returns HTTP 200 {} on valid payload
- POST /v1/metrics returns HTTP 400 on malformed JSON
- All 8 metric types parsed and accumulated
- Resource attributes extracted and written to session_metadata
- Existing /v1/logs and /hooks/:type routes unaffected

**Architectural Constraints**:
- MetricStore added to AppState alongside EventStore
- Session enrichment from resource attributes on first payload per session
- Effect boundary: HTTP in, database out

### Step 02-03: Session Metadata Enrichment from Log Records

**Description**: Extract terminal.type standard attribute from OTLP log records and resource attributes. Write session metadata on first log payload per session.

**Acceptance Criteria**:
- terminal.type extracted from log record standard attributes
- Resource attributes (service.version, os.type, host.arch) extracted
- Session metadata written via MetricStore on first payload
- Missing attributes produce null fields, not errors
- Existing OTLP log handler behavior unchanged

**Architectural Constraints**:
- Session enricher is a pure function
- Enrichment is additive to existing log handler flow

---

## Phase 03: IPC and Event-Based Cards

### Step 03-01: IPC Commands for Metrics and Metadata

**Description**: Add Tauri IPC commands for get_metrics_for_session, get_session_metadata, and get_all_session_metadata. Wire to MetricStore port.

**Acceptance Criteria**:
- get_metrics_for_session returns accumulated metrics for a session
- get_session_metadata returns enrichment data for a session
- get_all_session_metadata returns enrichment for all sessions
- Nonexistent session returns empty array / null

**Architectural Constraints**:
- IPC commands call MetricStore through shared state
- Return types are serializable DTOs

### Step 03-02: Session List Enrichment

**Description**: Enrich session list with IDE badge, Claude Code version, and platform from session metadata.

**Acceptance Criteria**:
- terminal.type mapped to human-readable IDE badge
- service.version displayed as "Claude Code {version}"
- os.type + host.arch displayed as "{OS} {arch}"
- Missing metadata produces no badge/text, not error
- Session list load time unaffected (<200ms)

**Architectural Constraints**:
- Badge mapping is a pure function in frontend
- Metadata fetched via get_all_session_metadata IPC

### Step 03-03: Session Dashboard Shell and Event-Based Cards

**Description**: Create session dashboard view with layout shell. Build Tool Usage, API Health, Prompt Activity, and Permissions cards. Each card has pure domain aggregator + thin view wrapper.

**Acceptance Criteria**:
- Dashboard shell renders all cards for a selected session
- Tool Usage shows call count, success rate, per-tool breakdown
- API Health shows error rate, error groups by status code
- Prompt Activity shows count, rate, avg length
- Permissions shows auto/user/rejected breakdown
- Zero events for a type shows informational empty state

**Architectural Constraints**:
- Each card domain module is pure (no IO, no React)
- View components are thin wrappers over domain logic
- Data from existing get_events_for_session IPC, filtered by event_type
- Dashboard registered as new view in norbert-usage plugin

---

## Phase 04: Metric-Based Cards

### Step 04-01: Active Time and Productivity Cards

**Description**: Build Active Time card (user/CLI split) and Productivity card (LOC, commits, PRs) from accumulated metric data.

**Acceptance Criteria**:
- Active Time displays user and CLI time in human-readable format
- Active Time shows percentage split
- Productivity shows lines added, removed, net change
- Git Activity shows commit count and PR count
- Empty state with guidance when no metric data available
- All values from pre-accumulated backend data

**Architectural Constraints**:
- Domain formatters are pure functions
- Data from get_metrics_for_session IPC
- Metric keys: active_time.total (type=user/cli), lines_of_code.count (type=added/removed), commit.count, pull_request.count

---

## Validation

### Quality Gates
- [ ] All 8 metric types ingested and accumulated correctly
- [ ] Model names normalized across events and metrics
- [ ] Session metadata extracted from first payload
- [ ] 6 dashboard cards populate from correct data sources
- [ ] Empty states display for missing data (not errors)
- [ ] Dashboard load <200ms for 500+ event sessions
- [ ] Existing PM, oscilloscope, gauge cluster unaffected
- [ ] Existing /v1/logs and /hooks/:type routes unaffected

### Implementation Scope
- **Backend production files** (~6): otel/metrics_parser, otel/model_normalizer, otel/session_enricher, ports/metric_store, adapters/db/metric_store, hook_receiver (modify)
- **Frontend production files** (~12): 6 domain aggregator/formatter modules, 6 view components, dashboard shell, session list enrichment
- **Schema**: 2 new tables (metrics, session_metadata)
- **IPC**: 3 new commands
- **ADRs**: 4 (ADR-035 through ADR-038)
