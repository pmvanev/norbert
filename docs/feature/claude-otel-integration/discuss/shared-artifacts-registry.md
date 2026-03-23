# Shared Artifacts Registry: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Journey**: OTel Data Ingestion
**Research Reference**: `docs/research/claude-code-otel-telemetry-actual-emissions.md` (2026-03-23)

---

## Artifacts

### hook_port

| Property | Value |
|----------|-------|
| Source of Truth | `src-tauri/src/domain/mod.rs` (`HOOK_PORT` constant = 3748) |
| Consumers | OTEL_EXPORTER_OTLP_ENDPOINT env var, hook receiver bind address, Norbert status display, norbert-cc-plugin settings.json |
| Owner | Domain module (Rust backend) |
| Integration Risk | HIGH -- port mismatch means OTel data never arrives |
| Validation | HOOK_PORT value must appear in OTEL_EXPORTER_OTLP_ENDPOINT documentation and norbert-cc-plugin settings.json |

### otel_endpoint

| Property | Value |
|----------|-------|
| Source of Truth | Derived from `HOOK_PORT`: `http://127.0.0.1:${HOOK_PORT}` |
| Consumers | Claude Code `OTEL_EXPORTER_OTLP_ENDPOINT` env var, norbert-cc-plugin settings.json, troubleshooting docs |
| Owner | Configuration / norbert-cc-plugin |
| Integration Risk | HIGH -- incorrect endpoint means no OTel data delivery |
| Validation | Must always be `http://127.0.0.1:3748` (localhost only, never external) |

### otlp_route

| Property | Value |
|----------|-------|
| Source of Truth | Hook receiver router configuration (new route) |
| Consumers | Claude Code OTLP logs exporter, hook receiver route table |
| Owner | Hook receiver (Rust backend) |
| Integration Risk | HIGH -- route must be `/v1/logs` per OTLP/HTTP specification for the logs signal |
| Validation | Path is `/v1/logs` (OTLP standard for logs/events), accepts POST with `application/json` content type |

### event_name

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel instrumentation |
| Consumers | OTLP log record parser event filter, event type mapping logic |
| Owner | Claude Code (external, not controlled by Norbert) |
| Integration Risk | MEDIUM -- if Claude Code renames events, parser stops matching |
| Validation | Event names: `claude_code.api_request`, `claude_code.user_prompt`, `claude_code.tool_result`, `claude_code.api_error`, `claude_code.tool_decision`. Parser should log unrecognized event names for early detection of changes. |

### session_id_attribute

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel standard attribute `session.id` (dot-separated) on every log record |
| Consumers | OTLP log record parser session extraction, session unification logic |
| Owner | Claude Code (external) |
| Integration Risk | HIGH -- attribute name mismatch means sessions fragment |
| Validation | Attribute key is `session.id` (dot, not underscore). It is a standard attribute on log records, NOT a resource attribute. Maps to internal `session_id`. |

### otel_token_fields

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel log record attribute definitions for `claude_code.api_request` events |
| Consumers | OTLP log record attribute parser, event payload normalizer |
| Owner | Claude Code (external) |
| Integration Risk | MEDIUM -- attribute name changes break extraction |
| Validation | Required attributes: `input_tokens`, `output_tokens`, `model`. Optional: `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `duration_ms`, `speed` |

### canonical_usage_shape

| Property | Value |
|----------|-------|
| Source of Truth | `src/plugins/norbert-usage/domain/tokenExtractor.ts` (expected payload structure) |
| Consumers | tokenExtractor.ts, metricsAggregator.ts, pricingModel.ts, OscilloscopeView.tsx |
| Owner | Frontend domain module |
| Integration Risk | HIGH -- OTel mapper must produce exactly this shape or tokenExtractor returns `{ tag: 'absent' }` |
| Validation | Payload must have `payload.usage.input_tokens`, `payload.usage.output_tokens`, `payload.usage.model` at minimum |

**Critical mapping note**: OTel uses `cache_read_tokens` but canonical shape uses `cache_read_input_tokens`. OTel uses `cache_creation_tokens` but canonical shape uses `cache_creation_input_tokens`. The OTLP-to-canonical mapper must rename these fields.

### event_type_api_request

| Property | Value |
|----------|-------|
| Source of Truth | `src-tauri/src/domain/mod.rs` (`EventType` enum, new `ApiRequest` variant) |
| Consumers | EventStore write path, frontend event poller, tokenExtractor event filtering |
| Owner | Domain module (Rust backend) |
| Integration Risk | HIGH -- new enum variant requires coordinated Rust and TypeScript changes |
| Validation | Serializes to `"api_request"` in snake_case JSON. Frontend must recognize this event type. |

### event_type_new_variants

| Property | Value |
|----------|-------|
| Source of Truth | `src-tauri/src/domain/mod.rs` (`EventType` enum, new variants for all 5 event types) |
| Consumers | EventStore write path, frontend event poller, event type filtering |
| Owner | Domain module (Rust backend) |
| Integration Risk | HIGH -- each new variant requires coordinated Rust and TypeScript changes |
| Validation | New variants: `UserPrompt` -> "user_prompt", `ToolResult` -> "tool_result", `ApiError` -> "api_error", `ToolDecision` -> "tool_decision". All must follow existing snake_case serialization pattern. |

### provider_name

| Property | Value |
|----------|-------|
| Source of Truth | `src-tauri/src/adapters/providers/claude_code.rs` (`ClaudeCodeProvider.provider_name()` = "claude_code") |
| Consumers | Event.provider field, frontend provider filtering, session attribution |
| Owner | Claude Code provider adapter |
| Integration Risk | LOW -- already established, OTel events reuse same provider name |
| Validation | OTel-sourced events use provider "claude_code", same as hook events |

### session_data_source

| Property | Value |
|----------|-------|
| Source of Truth | Per-session flag computed from presence of ApiRequest events |
| Consumers | Transcript polling decision logic, optional data source indicator |
| Owner | Frontend session management |
| Integration Risk | MEDIUM -- incorrect flag causes duplicate data or missing data |
| Validation | Session with any ApiRequest events has otelActive=true; session with zero ApiRequest events has otelActive=false |

### prompt_id_correlation

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel standard attribute `prompt.id` (UUID v4) on all event log records |
| Consumers | Event correlation logic, prompt-to-api-request linking |
| Owner | Claude Code (external) |
| Integration Risk | MEDIUM -- if prompt.id is absent or inconsistent, cross-event correlation fails |
| Validation | `prompt.id` links all events from a single user prompt (user_prompt, api_request, tool_result, tool_decision). Enables cost-per-prompt analysis. |

---

## Integration Checkpoints

### Checkpoint 1: Port Consistency

**Validates**: `hook_port`, `otel_endpoint`
**Rule**: The port in `OTEL_EXPORTER_OTLP_ENDPOINT` must equal `HOOK_PORT` from `domain/mod.rs`
**Failure mode**: OTel data sent to wrong port, silently lost
**Test**: norbert-cc-plugin settings.json reads `HOOK_PORT` constant and constructs endpoint URL from it

### Checkpoint 2: OTLP Route Compliance

**Validates**: `otlp_route`
**Rule**: Route must be exactly `/v1/logs` per OTLP/HTTP specification for the logs signal
**Failure mode**: Claude Code's OTel exporter sends to standard path but Norbert listens on different path
**Test**: Integration test sends OTLP request to `/v1/logs` and receives 200

### Checkpoint 3: Attribute-to-Payload Mapping

**Validates**: `otel_token_fields`, `canonical_usage_shape`
**Rule**: OTel log record attributes must be renamed to match `tokenExtractor.ts` expected shape
**Failure mode**: tokenExtractor returns `{ tag: 'absent' }`, token data silently missing from charts
**Test**: Unit test maps known OTel attributes to canonical shape, feeds to tokenExtractor, verifies `{ tag: 'found' }`

### Checkpoint 4: EventType Coordination

**Validates**: `event_type_api_request`, `event_type_new_variants`
**Rule**: All new EventType variants must serialize to snake_case and be recognized by both Rust and TypeScript
**Failure mode**: Events stored but not retrieved by frontend, or stored under wrong type
**Test**: Rust serialization test + TypeScript event type filtering test for all new variants

### Checkpoint 5: Data Source Detection

**Validates**: `session_data_source`
**Rule**: Sessions receiving OTel data must not also receive transcript-polled data
**Failure mode**: Duplicate token counts, inflated costs
**Test**: Integration test with OTel-active session verifies transcript poller skips it

### Checkpoint 6: Session ID Attribute Extraction

**Validates**: `session_id_attribute`
**Rule**: Parser must extract `session.id` (dot-separated) from log record attributes, not `session_id` (underscore) and not from resource attributes
**Failure mode**: Sessions fragment -- hook events and OTel events for the same Claude Code session appear as different sessions
**Test**: Unit test verifies `session.id` attribute extracted from log record attributes and mapped to internal `session_id`

### Checkpoint 7: Event Name Routing

**Validates**: `event_name`
**Rule**: All 5 Claude Code event names must be recognized and routed to the correct EventType variant
**Failure mode**: Events from unknown types silently dropped or misclassified
**Test**: Unit test maps each event name to its EventType: api_request->ApiRequest, user_prompt->UserPrompt, tool_result->ToolResult, api_error->ApiError, tool_decision->ToolDecision

---

## Risk Summary

| Risk Level | Count | Artifacts |
|------------|-------|-----------|
| HIGH | 5 | hook_port, otlp_route, canonical_usage_shape, event_type_api_request, session_id_attribute |
| MEDIUM | 4 | event_name, otel_token_fields, session_data_source, prompt_id_correlation |
| LOW | 1 | provider_name |
