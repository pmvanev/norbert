# Component Boundaries: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-20

---

## New Components

### 1. OTLP Parser Module (Rust, pure)

**Location**: New module in `src-tauri/src/adapters/otel/`
**Responsibility**: Parse OTLP/HTTP JSON (`ExportTraceServiceRequest`) into typed Rust structs. Filter for `claude_code.api_request` spans. Extract session_id from span or resource attributes.
**Boundary**: Pure data transformation. No IO, no database access, no HTTP framework types.
**Input**: `serde_json::Value` (raw JSON body)
**Output**: `Vec<OtelSpanData>` -- extracted span data with session_id and attributes

### 2. Attribute Mapper (Rust, pure function)

**Location**: Within `src-tauri/src/adapters/otel/` module
**Responsibility**: Transform OTel span attribute names to canonical event payload shape expected by `tokenExtractor.ts`.
**Boundary**: Pure function mapping field names. No IO.
**Input**: `OtelSpanData` (parsed span with raw attribute names)
**Output**: `Event` (canonical domain event with `EventType::ApiRequest` and mapped payload)

**Mapping rules**:
- `input_tokens` -> `usage.input_tokens` (unchanged)
- `output_tokens` -> `usage.output_tokens` (unchanged)
- `cache_read_tokens` -> `usage.cache_read_input_tokens` (renamed)
- `cache_creation_tokens` -> `usage.cache_creation_input_tokens` (renamed)
- `cost_usd` -> `usage.cost_usd` (new field, passed through)
- `model` -> `usage.model` (unchanged)

### 3. OTLP Handler (Rust, axum handler)

**Location**: `src-tauri/src/hook_receiver.rs` (new handler function)
**Responsibility**: HTTP handler for `POST /v1/traces`. Deserializes body, delegates to parser and mapper, persists events via EventStore.
**Boundary**: Effect boundary -- accepts HTTP, writes to database. Composes pure parser + mapper.
**Input**: HTTP POST with `application/json` body
**Output**: HTTP 200 OK (success) or 400 Bad Request (malformed JSON)

---

## Modified Components

### 4. Domain Model (`domain/mod.rs`)

**Change**: Add `ApiRequest` variant to `EventType` enum.
**Impact**: Update `Display` impl, all exhaustive `match` statements (compiler-enforced).
**Boundary**: Pure domain type. No behavioral change to existing variants.

### 5. ClaudeCodeProvider (`adapters/providers/claude_code.rs`)

**Change**: None to the provider itself. `parse_event_type` does NOT map any hook name to `ApiRequest`. The test `every_hook_event_name_is_parseable_and_every_variant_has_a_hook_name` must be updated to exclude `ApiRequest` from the variant-has-hook-name assertion.

### 6. Axum Router (`hook_receiver.rs`)

**Change**: Add `POST /v1/traces` route to `build_router()`.
**Impact**: New route coexists with existing `/hooks/:type`. Shared `AppState`.

### 7. Metrics Aggregator (`metricsAggregator.ts`)

**Change**: Add `api_request` to event handler dispatch table. When processing `api_request` events, extract tokens and compute cost. When `cost_usd` is present in payload, use it directly instead of calling `calculateCost`.
**Boundary**: Pure function. No IO change.

### 8. Transcript Polling (`App.tsx`)

**Change**: Before polling a session's transcript, check if that session has received any `api_request` events. If yes, skip transcript polling for that session.
**Boundary**: Effect boundary (existing). Detection logic is pure.

---

## Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `tokenExtractor.ts` | Already looks for `payload.usage.input_tokens` etc. OTel events produce the same shape. |
| `pricingModel.ts` | Fallback path unchanged. Bypassed when `cost_usd` present, but code stays. |
| `hookProcessor.ts` | Processes events by `event_type`. Will process `api_request` events via the dispatch table in metricsAggregator. |
| `SqliteEventStore` | `write_event()` handles any `EventType`. Schema stores event_type as TEXT. No migration needed. |
| `EventStore` trait (`ports/mod.rs`) | No interface change. `write_event(&Event)` accepts ApiRequest events without modification. |

---

## Dependency Direction

```
hook_receiver.rs (adapter, effect boundary)
    |
    +-- uses --> otel/ parser + mapper (adapter, pure)
    |                |
    |                +-- uses --> domain/mod.rs (EventType::ApiRequest, Event)
    |
    +-- uses --> ports/mod.rs (EventStore trait)
    +-- uses --> adapters/db/ (SqliteEventStore)

Frontend:
    metricsAggregator.ts (domain, pure)
        |
        +-- uses --> tokenExtractor.ts (domain, pure) [unchanged]
        +-- uses --> pricingModel.ts (domain, pure) [bypassed when cost_usd present]
```

All dependencies point inward toward the domain. The new OTel adapter depends on the domain; the domain does not know about OTel.
