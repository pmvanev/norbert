# Component Boundaries: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23 (corrected from 2026-03-20 based on research findings)

---

## New Components

### 1. OTLP Log Parser Module (Rust, pure)

**Location**: New module in `src-tauri/src/adapters/otel/`
**Responsibility**: Parse OTLP/HTTP JSON (`ExportLogsServiceRequest`) into typed Rust structs. Traverse `resourceLogs[].scopeLogs[].logRecords[]`. Extract `event.name` and `session.id` from log record attributes. Route recognized Claude Code events to type-specific extractors.
**Boundary**: Pure data transformation. No IO, no database access, no HTTP framework types.
**Input**: `serde_json::Value` (raw JSON body)
**Output**: `Vec<ParsedOtelEvent>` -- extracted event data with session_id, event type, and typed payload

### 2. Event-Type Extractors (Rust, pure functions)

**Location**: Within `src-tauri/src/adapters/otel/` module
**Responsibility**: Per-event-type attribute validation and extraction. Each extractor validates required attributes, extracts optional attributes, and produces a canonical payload for its event type.

**Extractors**:
- **ApiRequest extractor**: Validates `input_tokens`, `output_tokens`, `model` (required). Maps `cache_read_tokens` -> `cache_read_input_tokens`, `cache_creation_tokens` -> `cache_creation_input_tokens`. Passes through `cost_usd`, `duration_ms`, `speed`.
- **UserPrompt extractor**: Validates `prompt_length` (required). Passes through `prompt` (optional).
- **ToolResult extractor**: Validates `tool_name` (required). Passes through `success`, `duration_ms`, `error`, `tool_result_size_bytes`, `mcp_server_scope`.
- **ApiError extractor**: Validates `error` (required). Passes through `model`, `status_code`, `duration_ms`, `attempt`, `speed`.
- **ToolDecision extractor**: Validates `tool_name` (required). Passes through `decision`, `source`.

**Boundary**: Pure functions. No IO. Each returns `Option<Event>` (None when required attributes missing).

### 3. Attribute Mapper (Rust, pure function)

**Location**: Within `src-tauri/src/adapters/otel/` module
**Responsibility**: Transform OTel log record attribute key-value pairs into canonical event payload shape expected by the frontend.
**Boundary**: Pure function mapping field names and resolving OTel typed values (`intValue`, `doubleValue`, `stringValue`, `boolValue`).

### 4. OTLP Handler (Rust, axum handler)

**Location**: `src-tauri/src/hook_receiver.rs` (new handler function)
**Responsibility**: HTTP handler for `POST /v1/logs`. Deserializes body, delegates to parser and extractors, persists events via EventStore.
**Boundary**: Effect boundary -- accepts HTTP, writes to database. Composes pure parser + extractors.
**Input**: HTTP POST with `application/json` body
**Output**: HTTP 200 OK (success, including when no recognized events found) or 400 Bad Request (malformed JSON)

---

## Modified Components

### 5. Domain Model (`domain/mod.rs`)

**Change**: Add 5 new variants to `EventType` enum: `ApiRequest`, `UserPrompt`, `ToolResult`, `ApiError`, `ToolDecision`.
**Impact**: Update `Display` impl, all exhaustive `match` statements (compiler-enforced).
**Boundary**: Pure domain types. No behavioral change to existing variants.

### 6. ClaudeCodeProvider (`adapters/providers/claude_code.rs`)

**Change**: None to the provider itself. `parse_event_type` does NOT map any hook name to the new variants. The test `every_hook_event_name_is_parseable_and_every_variant_has_a_hook_name` must be updated to exclude the 5 new OTel-only variants from the variant-has-hook-name assertion.

### 7. Axum Router (`hook_receiver.rs`)

**Change**: Add `POST /v1/logs` route to `build_router()`.
**Impact**: New route coexists with existing `/hooks/:type`. Shared `AppState`.

### 8. Metrics Aggregator (`metricsAggregator.ts`)

**Change**: Add `api_request` to event handler dispatch table with token extraction and cost bypass logic. Add `user_prompt`, `tool_result`, `api_error`, `tool_decision` as identity handlers (hookEventCount only).
**Boundary**: Pure function. No IO change.

### 9. Transcript Polling (`App.tsx`)

**Change**: Before polling a session's transcript, check if that session has received any `api_request` events. If yes, skip transcript polling for that session.
**Boundary**: Effect boundary (existing). Detection logic is pure.

---

## Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `tokenExtractor.ts` | Already looks for `payload.usage.input_tokens` etc. OTel api_request events produce the same shape after attribute mapping. |
| `pricingModel.ts` | Fallback path unchanged. Bypassed when `cost_usd` present, but code stays. |
| `SqliteEventStore` | `write_event()` handles any `EventType`. Schema stores event_type as TEXT. No migration needed. |
| `EventStore` trait (`ports/mod.rs`) | No interface change. `write_event(&Event)` accepts all new event types without modification. |
| `EventProvider` trait (`ports/mod.rs`) | Not used by OTel path. OTel events bypass the EventProvider normalization (they have their own parser). |

---

## Dependency Direction

```
hook_receiver.rs (adapter, effect boundary)
    |
    +-- uses --> otel/ parser + extractors + mapper (adapter, pure)
    |                |
    |                +-- uses --> domain/mod.rs (EventType variants, Event)
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
