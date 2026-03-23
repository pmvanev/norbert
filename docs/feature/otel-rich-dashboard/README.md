# Feature: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Predecessor**: claude-otel-integration (must complete first)
**Status**: DISCOVER (not started)

## Overview

Expand Norbert's OTel integration to collect ALL available Claude Code telemetry and display it in meaningful, feature-rich dashboard views. The predecessor feature (`claude-otel-integration`) establishes the OTLP ingestion pipeline for `/v1/logs` with 5 event types. This feature adds `/v1/metrics` ingestion, stores all available attributes, and creates rich UI surfaces for every data source.

## Scope (What This Feature Adds)

### 1. Metrics Ingestion (`/v1/metrics` route)

Add a `POST /v1/metrics` handler to the hook receiver. Parse `ExportMetricsServiceRequest` payloads. Store metric data points with all attributes.

**Metrics to ingest** (all confirmed from live spike, Claude Code v2.1.81):

| Metric | Unit | Key Attributes |
|--------|------|---------------|
| `claude_code.session.count` | count | standard |
| `claude_code.cost.usage` | USD | `model` |
| `claude_code.token.usage` | tokens | `model`, `type` (input/output/cacheRead/cacheCreation) |
| `claude_code.active_time.total` | s | `type` (user/cli) |
| `claude_code.lines_of_code.count` | count | `type` (added/removed) |
| `claude_code.commit.count` | count | standard |
| `claude_code.pull_request.count` | count | standard |
| `claude_code.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `language` |

All use `sum` type, delta temporality, monotonic. Values always `asDouble`.

### 2. Store All Standard + Resource Attributes

Enrich every persisted event with all available attributes:

**Standard attributes** (per event):
- `session.id`, `prompt.id`, `event.sequence`, `event.timestamp`
- `user.id`, `organization.id`, `user.email`, `user.account_uuid`, `user.account_id`
- `terminal.type`

**Resource attributes** (per request, apply to all events in batch):
- `service.name`, `service.version`
- `os.type`, `os.version`, `host.arch`

### 3. UI Plans for All Event Types

| Event | UI Surface | What it shows |
|-------|-----------|---------------|
| `api_request` | Already handled by predecessor | Token rate, cost, model breakdown |
| `user_prompt` | New "Prompt Activity" metric card | Prompts/min rate, avg prompt length, prompt count |
| `tool_result` | New "Tool Usage" card + breakdown | Tool success rate %, avg duration, tool name breakdown, error count |
| `api_error` | New "API Health" indicator | Error rate, error types (429/500/etc), retry attempts |
| `tool_decision` | New "Permissions" card | Accept/reject ratio, auto vs user-approved |

### 4. UI Plans for Metrics

| Metric | UI Surface | What it shows |
|--------|-----------|---------------|
| `session.count` | Session list header | Total sessions count |
| `cost.usage` | Supplement existing cost card | Running cost by model (delta accumulation) |
| `token.usage` | Supplement existing token cards | Token breakdown by type and model |
| `active_time.total` | New "Active Time" gauge | User interaction vs CLI processing split |
| `lines_of_code.count` | New "Productivity" card | Lines added/removed, net change |
| `commit.count` | New "Git Activity" card | Commits created by Claude |
| `pull_request.count` | New "Git Activity" card | PRs created by Claude |
| `code_edit_tool.decision` | Merge into "Permissions" card | Accept/reject by tool, language breakdown |

### 5. Session Enrichment from Attributes

| Attribute | Where | How used |
|-----------|-------|----------|
| `terminal.type` | Session metadata | IDE icon/badge in session list |
| `service.version` | Session metadata | Claude Code version in session detail |
| `os.type` + `host.arch` | Session metadata | Platform info in session detail |
| `user.email` | Session metadata | Multi-user identification |
| `prompt.id` | Event correlation | Link prompt → API calls → tool uses in timeline view |
| `event.sequence` | Event ordering | Correct chronological ordering within session |

## Technical Context

### What the predecessor provides
- `POST /v1/logs` route on port 3748
- OTLP JSON log record parser (ExportLogsServiceRequest)
- 5 new EventType variants (ApiRequest, UserPrompt, ToolResult, ApiError, ToolDecision)
- Per-event-type attribute extractors
- `session.id` extraction and session routing
- ApiRequest → metricsAggregator token/cost pipeline
- Transcript polling suppression for OTel-active sessions

### What this feature adds on top
- `POST /v1/metrics` route (new handler, same port)
- OTLP JSON metrics parser (ExportMetricsServiceRequest)
- Metrics storage (new table or event-based approach)
- Delta temporality accumulation logic
- Extended attribute storage (all standard + resource attrs)
- 5+ new UI components for event and metric visualization

### Key Design Decisions (to resolve in DESIGN wave)
1. **Metrics storage**: New `metrics` table vs synthetic events in `events` table?
2. **Delta accumulation**: Accumulate in frontend (like current polling) or backend?
3. **Model name normalization**: Metrics use `claude-opus-4-6[1m]`, events use `claude-opus-4-6` — normalize where?
4. **Attribute storage**: Expand events table columns vs JSON blob in payload?
5. **UI layout**: New plugin views vs extend existing Performance Monitor?

## Verified Data (from spike)

All data models verified against live Claude Code v2.1.81 output.
See `otel-raw-dump.jsonl` for raw captured payloads.
See `docs/research/claude-code-otel-telemetry-actual-emissions.md` for research.
See `docs/research/otlp-json-wire-format-specification.md` for OTLP spec details.
See `docs/feature/claude-otel-integration/design/data-models.md` for verified payload structures.

## Dependencies

- **Hard dependency**: `claude-otel-integration` must be complete (provides the OTLP parsing infrastructure and event pipeline)
- **Reuses**: OTLP JSON parsing structs, AnyValue extraction helpers, session routing logic
