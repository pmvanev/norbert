# Implementation Roadmap: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-20
**Paradigm**: Functional programming
**Estimated production files**: 5 (domain/mod.rs, otel module, hook_receiver.rs, metricsAggregator.ts, App.tsx)

---

## Rejected Simple Alternatives

### Alternative 1: Pipe OTel to existing hook endpoint via middleware
- **What**: HTTP middleware rewrites OTLP JSON to hook format before reaching hook handler
- **Expected Impact**: 80% -- would work for span parsing but cannot extract session_id correctly
- **Why Insufficient**: OTLP structure is fundamentally different (nested arrays of resource/scope/span). Middleware rewrite would be as complex as a dedicated handler without the clarity.

### Alternative 2: Frontend-only fetch from OTLP collector
- **What**: Frontend polls an external OTel collector for span data
- **Expected Impact**: 100% of data delivery, but violates architecture
- **Why Insufficient**: Adds external process dependency, breaks local-first single-binary model (ADR-005). Frontend should not directly handle telemetry ingestion.

### Why Dedicated OTLP Handler Necessary
1. OTLP JSON format requires purpose-built parser (nested resource/scope/span arrays)
2. Attribute name mapping (cache_read_tokens -> cache_read_input_tokens) is domain-specific
3. Session ID extraction requires checking multiple attribute locations
4. Single handler cleanly separates OTel concerns from hook concerns

---

## Roadmap

### Phase 01: Backend -- Domain and OTLP Ingestion

#### Step 01-01: ApiRequest event type in domain model

**Description**: Add ApiRequest variant to EventType enum. Update Display impl and all exhaustive matches. Exclude from HOOK_EVENT_NAMES.

**Acceptance Criteria**:
- ApiRequest variant serializes to "api_request" and deserializes from "api_request"
- Display trait outputs "api_request"
- Existing six event types serialize/deserialize unchanged
- Compiler reports no unhandled match arms

**Architectural Constraints**:
- ApiRequest is NOT a hook event; parse_event_type returns None for it
- Test asserting variant count updates from 6 to 7

**Traceability**: US-COI-004

---

#### Step 01-02: OTLP parser and attribute mapper

**Description**: Pure module parsing OTLP/HTTP JSON. Extract claude_code.api_request spans, map attributes to canonical usage payload, resolve session_id.

**Acceptance Criteria**:
- Parses valid ExportTraceServiceRequest JSON into typed span data
- Only claude_code.api_request spans produce events; other spans silently ignored
- cache_read_tokens mapped to cache_read_input_tokens, cache_creation_tokens to cache_creation_input_tokens
- Missing required attribute (input_tokens, output_tokens, model) drops span
- Session ID extracted from span attributes, falling back to resource attributes

**Architectural Constraints**:
- Pure module with no IO imports -- serde_json only
- Resides in adapters/otel/ (not domain, not ports)
- OTLP JSON parsed with hand-written serde structs, not opentelemetry-proto

**Traceability**: US-COI-001, US-COI-005

---

#### Step 01-03: OTLP HTTP handler and route

**Description**: Add POST /v1/traces handler to axum router. Deserialize body, delegate to parser/mapper, persist events via EventStore.

**Acceptance Criteria**:
- POST /v1/traces returns 200 OK for valid OTLP JSON containing claude_code.api_request spans
- Events persisted with event_type "api_request" and provider "claude_code"
- Returns 200 OK for valid OTLP with no claude_code.api_request spans (no events persisted)
- Returns 400 Bad Request for malformed JSON
- Existing /hooks/:type routes unaffected

**Architectural Constraints**:
- Handler in hook_receiver.rs, shares existing AppState
- Effect boundary: HTTP + EventStore write; delegates to pure parser/mapper

**Traceability**: US-COI-001

---

### Phase 02: Frontend -- Cost Bypass and Polling Suppression

#### Step 02-01: ApiRequest event handling with authoritative cost

**Description**: Add api_request to metricsAggregator dispatch table. When cost_usd present in payload, use directly instead of pricing model calculation.

**Acceptance Criteria**:
- api_request events with token usage update session metrics (tokens, cost)
- cost_usd present: session cost increases by exact cost_usd value
- cost_usd absent: session cost calculated via pricing model (existing behavior)
- cost_usd = 0.0 treated as valid zero cost, not as missing

**Architectural Constraints**:
- Pure function change in metricsAggregator.ts
- pricingModel.ts unchanged -- bypassed, not modified
- tokenExtractor.ts unchanged -- payload shape already compatible

**Traceability**: US-COI-002

---

#### Step 02-02: Transcript polling suppression for OTel-active sessions

**Description**: Before polling a session's transcript, check if that session has received any api_request events. Skip transcript polling for OTel-active sessions.

**Acceptance Criteria**:
- Sessions with api_request events skip transcript polling
- Sessions without api_request events continue transcript polling
- Mixed sessions (some OTel, some transcript) handled independently
- First api_request event triggers OTel-active detection for that session

**Architectural Constraints**:
- Detection derived from event data, not stored flag
- Per-session check, not global toggle
- Transcript polling logic in App.tsx modified at effect boundary

**Traceability**: US-COI-003

---

## Step Ratio Check

- Steps: 5
- Estimated production files: 5 (domain/mod.rs, adapters/otel/mod.rs, hook_receiver.rs, metricsAggregator.ts, App.tsx)
- Ratio: 5/5 = 1.0 (within 2.5 limit)

## Dependency Order

```
Step 01-01 (ApiRequest type)
    |
    v
Step 01-02 (OTLP parser + mapper) -- depends on ApiRequest type
    |
    v
Step 01-03 (HTTP handler + route) -- depends on parser/mapper
    |
    +---> Step 02-01 (authoritative cost) -- depends on api_request events flowing
    |
    +---> Step 02-02 (polling suppression) -- depends on api_request events flowing
```
