# Implementation Roadmap: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23 (corrected from 2026-03-20)
**Paradigm**: Functional programming
**Estimated production files**: 5 (domain/mod.rs, adapters/otel/mod.rs, hook_receiver.rs, metricsAggregator.ts, App.tsx)

---

## Rejected Simple Alternatives

### Alternative 1: Pipe OTel to existing hook endpoint via middleware
- **What**: HTTP middleware rewrites OTLP JSON to hook format before reaching hook handler
- **Expected Impact**: 80% -- would work for log record parsing but cannot handle 5 event types cleanly
- **Why Insufficient**: OTLP structure is fundamentally different (nested `resourceLogs/scopeLogs/logRecords` arrays). Middleware rewrite would be as complex as a dedicated handler without the clarity. `session.id` (dot-separated) in log record attributes vs `session_id` in hook JSON requires distinct extraction logic.

### Alternative 2: Frontend-only fetch from OTLP collector
- **What**: Frontend polls an external OTel collector for event data
- **Expected Impact**: 100% of data delivery, but violates architecture
- **Why Insufficient**: Adds external process dependency, breaks local-first single-binary model (ADR-005). Frontend should not directly handle telemetry ingestion.

### Why Dedicated OTLP Handler Necessary
1. OTLP JSON format requires purpose-built parser (nested `resourceLogs/scopeLogs/logRecords` arrays)
2. 5 event types need type-specific attribute validation and extraction
3. Attribute name mapping (e.g., `cache_read_tokens` -> `cache_read_input_tokens`) is domain-specific
4. `session.id` extraction differs from hook `session_id` extraction
5. Single handler cleanly separates OTel concerns from hook concerns

---

## Roadmap

### Phase 01: Backend -- Domain and OTLP Ingestion

#### Step 01-01: New EventType variants in domain model

**Description**: Add 5 OTel event type variants to EventType enum: ApiRequest, UserPrompt, ToolResult, ApiError, ToolDecision. Update Display impl and all exhaustive matches.

**Acceptance Criteria**:
- All 5 variants serialize/deserialize to/from snake_case
- Display trait outputs matching snake_case strings
- Existing 6 event types serialize/deserialize unchanged
- Compiler reports no unhandled match arms

**Architectural Constraints**:
- New variants are NOT hook events; `parse_event_type` returns None for them
- Test asserting variant count updates from 6 to 11

**Traceability**: US-COI-004, US-COI-006, US-COI-007, US-COI-008, US-COI-009

---

#### Step 01-02: OTLP log record parser and event extractors

**Description**: Pure module parsing OTLP/HTTP JSON (`ExportLogsServiceRequest`). Generic envelope parser + per-event-type attribute extractors. Resolve `session.id` from log record attributes.

**Acceptance Criteria**:
- Parses valid `ExportLogsServiceRequest` JSON into typed log record data
- Routes log records by `event.name` to type-specific extractors
- `api_request`: maps `cache_read_tokens` to `cache_read_input_tokens`, `cache_creation_tokens` to `cache_creation_input_tokens`; requires `input_tokens`, `output_tokens`, `model`
- `user_prompt`: requires `prompt_length`; `prompt` optional
- `tool_result`: requires `tool_name`; success/duration/error optional
- `api_error`: requires `error`; status_code/duration/attempt optional
- `tool_decision`: requires `tool_name`; decision/source optional
- Missing required attribute drops the log record with warning
- `session.id` (dot-separated) extracted from log record attributes (not resource attributes)
- Unrecognized event names silently ignored

**Architectural Constraints**:
- Pure module with no IO imports -- serde_json only
- Resides in `adapters/otel/` (not domain, not ports)
- OTLP JSON parsed with hand-written serde structs, not opentelemetry-proto
- `prompt.id` preserved in payload for cross-event correlation

**Traceability**: US-COI-001, US-COI-005, US-COI-006, US-COI-007, US-COI-008, US-COI-009

---

#### Step 01-03: OTLP HTTP handler and route

**Description**: Add `POST /v1/logs` handler to axum router. Deserialize body, delegate to parser/extractors, persist events via EventStore.

**Acceptance Criteria**:
- `POST /v1/logs` returns 200 OK for valid OTLP JSON containing recognized events
- Events persisted with correct event_type and provider "claude_code"
- Returns 200 OK for valid OTLP with no recognized events (no events persisted)
- Returns 400 Bad Request for malformed JSON
- Existing `/hooks/:type` routes unaffected

**Architectural Constraints**:
- Handler in `hook_receiver.rs`, shares existing AppState
- Effect boundary: HTTP + EventStore write; delegates to pure parser/extractors

**Traceability**: US-COI-001

---

### Phase 02: Frontend -- Cost Bypass and Polling Suppression

#### Step 02-01: OTel event handling in metrics aggregator with cost bypass

**Description**: Add all 5 event types to metricsAggregator dispatch table. `api_request`: extract tokens and use `cost_usd` when present. Others: identity handlers (hookEventCount only).

**Acceptance Criteria**:
- `api_request` events with token usage update session metrics (tokens, cost)
- `cost_usd` present: session cost increases by exact `cost_usd` value
- `cost_usd` absent: session cost calculated via pricing model (existing behavior)
- `cost_usd = 0.0` treated as valid zero cost, not as missing
- `user_prompt`, `tool_result`, `api_error`, `tool_decision` increment hookEventCount

**Architectural Constraints**:
- Pure function change in `metricsAggregator.ts`
- `pricingModel.ts` unchanged -- bypassed, not modified
- `tokenExtractor.ts` unchanged -- payload shape already compatible

**Traceability**: US-COI-002, US-COI-006, US-COI-007, US-COI-008, US-COI-009

---

#### Step 02-02: Transcript polling suppression for OTel-active sessions

**Description**: Before polling a session's transcript, check if that session has received any `api_request` events. Skip transcript polling for OTel-active sessions.

**Acceptance Criteria**:
- Sessions with `api_request` events skip transcript polling
- Sessions without `api_request` events continue transcript polling
- First `api_request` event triggers OTel-active detection for that session
- Mixed sessions (some OTel, some transcript) handled independently

**Architectural Constraints**:
- Detection derived from event data, not stored flag
- Per-session check, not global toggle
- Transcript polling logic in `App.tsx` modified at effect boundary

**Traceability**: US-COI-003

---

## Step Ratio Check

- Steps: 5
- Estimated production files: 5 (domain/mod.rs, adapters/otel/mod.rs, hook_receiver.rs, metricsAggregator.ts, App.tsx)
- Ratio: 5/5 = 1.0 (within 2.5 limit)

## Identical Pattern Check

Steps 01-02 batches all 5 event type extractors into a single step (they share the same envelope parser and follow the same extraction pattern). Without batching, this would have been 5 separate steps differing only by event type name and required attributes. Batching: 5 -> 1.

Step 01-01 batches all 5 new EventType variants into a single step (identical enum addition pattern). Without batching: 5 -> 1.

Step 02-01 batches all 5 event types into the dispatch table in a single step. Without batching: 5 -> 1.

## Dependency Order

```
Step 01-01 (EventType variants)
    |
    v
Step 01-02 (OTLP parser + extractors) -- depends on EventType variants
    |
    v
Step 01-03 (HTTP handler + route) -- depends on parser/extractors
    |
    +---> Step 02-01 (cost bypass + dispatch table) -- depends on events flowing
    |
    +---> Step 02-02 (polling suppression) -- depends on api_request events flowing
```

## Story-to-Step Mapping

| User Story | Step(s) |
|-----------|---------|
| US-COI-004 (ApiRequest type) | 01-01 |
| US-COI-005 (Session identity) | 01-02 |
| US-COI-001 (OTLP endpoint) | 01-02, 01-03 |
| US-COI-006 (User prompt events) | 01-01, 01-02, 02-01 |
| US-COI-007 (Tool result events) | 01-01, 01-02, 02-01 |
| US-COI-008 (API error events) | 01-01, 01-02, 02-01 |
| US-COI-009 (Tool decision events) | 01-01, 01-02, 02-01 |
| US-COI-002 (OTel-reported cost) | 02-01 |
| US-COI-003 (Polling suppression) | 02-02 |
