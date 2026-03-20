# Shared Artifacts Registry: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Journey**: OTel Data Ingestion

---

## Artifacts

### hook_port

| Property | Value |
|----------|-------|
| Source of Truth | `src-tauri/src/domain/mod.rs` (`HOOK_PORT` constant = 3748) |
| Consumers | OTEL_EXPORTER_OTLP_ENDPOINT env var, hook receiver bind address, Norbert status display, setup wizard |
| Owner | Domain module (Rust backend) |
| Integration Risk | HIGH -- port mismatch means OTel data never arrives |
| Validation | HOOK_PORT value must appear in OTEL_EXPORTER_OTLP_ENDPOINT documentation and setup wizard output |

### otel_endpoint

| Property | Value |
|----------|-------|
| Source of Truth | Derived from `HOOK_PORT`: `http://127.0.0.1:${HOOK_PORT}` |
| Consumers | Claude Code `OTEL_EXPORTER_OTLP_ENDPOINT` env var, setup wizard display, troubleshooting docs |
| Owner | Configuration / setup wizard |
| Integration Risk | HIGH -- incorrect endpoint means no OTel data delivery |
| Validation | Must always be `http://127.0.0.1:3748` (localhost only, never external) |

### otlp_route

| Property | Value |
|----------|-------|
| Source of Truth | Hook receiver router configuration (new route) |
| Consumers | Claude Code OTLP exporter, hook receiver route table |
| Owner | Hook receiver (Rust backend) |
| Integration Risk | HIGH -- route must be `/v1/traces` per OTLP/HTTP specification |
| Validation | Path is `/v1/traces` (OTLP standard), accepts POST with `application/json` content type |

### span_name

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel instrumentation |
| Consumers | OTLP parser span filter, event type mapping logic |
| Owner | Claude Code (external, not controlled by Norbert) |
| Integration Risk | MEDIUM -- if Claude Code renames the span, parser stops matching |
| Validation | Span name is `claude_code.api_request`; parser should log unrecognized span names for early detection of changes |

### otel_token_fields

| Property | Value |
|----------|-------|
| Source of Truth | Claude Code OTel span attribute definitions |
| Consumers | OTLP span attribute parser, event payload normalizer |
| Owner | Claude Code (external) |
| Integration Risk | MEDIUM -- attribute name changes break extraction |
| Validation | Required attributes: `input_tokens`, `output_tokens`, `model`. Optional: `cache_read_tokens`, `cache_creation_tokens`, `cost_usd` |

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

---

## Integration Checkpoints

### Checkpoint 1: Port Consistency

**Validates**: `hook_port`, `otel_endpoint`
**Rule**: The port in `OTEL_EXPORTER_OTLP_ENDPOINT` must equal `HOOK_PORT` from `domain/mod.rs`
**Failure mode**: OTel data sent to wrong port, silently lost
**Test**: Setup wizard reads `HOOK_PORT` constant and constructs endpoint URL from it

### Checkpoint 2: OTLP Route Compliance

**Validates**: `otlp_route`
**Rule**: Route must be exactly `/v1/traces` per OTLP/HTTP specification
**Failure mode**: Claude Code's OTel exporter sends to standard path but Norbert listens on different path
**Test**: Integration test sends OTLP request to `/v1/traces` and receives 200

### Checkpoint 3: Attribute-to-Payload Mapping

**Validates**: `otel_token_fields`, `canonical_usage_shape`
**Rule**: OTel span attributes must be renamed to match `tokenExtractor.ts` expected shape
**Failure mode**: tokenExtractor returns `{ tag: 'absent' }`, token data silently missing from charts
**Test**: Unit test maps known OTel attributes to canonical shape, feeds to tokenExtractor, verifies `{ tag: 'found' }`

### Checkpoint 4: EventType Coordination

**Validates**: `event_type_api_request`
**Rule**: New `ApiRequest` variant must serialize to `"api_request"` and be recognized by both Rust and TypeScript
**Failure mode**: Events stored but not retrieved by frontend, or stored under wrong type
**Test**: Rust serialization test + TypeScript event type filtering test

### Checkpoint 5: Data Source Detection

**Validates**: `session_data_source`
**Rule**: Sessions receiving OTel data must not also receive transcript-polled data
**Failure mode**: Duplicate token counts, inflated costs
**Test**: Integration test with OTel-active session verifies transcript poller skips it

---

## Risk Summary

| Risk Level | Count | Artifacts |
|------------|-------|-----------|
| HIGH | 4 | hook_port, otlp_route, canonical_usage_shape, event_type_api_request |
| MEDIUM | 3 | span_name, otel_token_fields, session_data_source |
| LOW | 1 | provider_name |
