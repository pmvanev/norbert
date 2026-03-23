# ADR-031: OTLP JSON Parsing Strategy

## Status

Accepted (updated 2026-03-23: corrected from ExportTraceServiceRequest to ExportLogsServiceRequest per research findings)

## Context

The OTLP/HTTP endpoint needs to parse `ExportLogsServiceRequest` payloads containing OTel log records (events). Three approaches were considered for parsing the OTLP format in Rust: using the `opentelemetry-proto` crate with full protobuf type definitions, using `serde_json` with hand-written structs matching the JSON subset, or using raw `serde_json::Value` traversal without typed structs.

**Research correction (2026-03-23)**: Claude Code sends `ExportLogsServiceRequest` (not `ExportTraceServiceRequest`). The struct hierarchy is `resourceLogs / scopeLogs / logRecords` (not `resourceSpans / scopeSpans / spans`). See `docs/research/claude-code-otel-telemetry-actual-emissions.md`.

Norbert needs to parse 5 event types (`claude_code.api_request`, `claude_code.user_prompt`, `claude_code.tool_result`, `claude_code.api_error`, `claude_code.tool_decision`) and extract type-specific attributes from each. The OTLP JSON structure is well-documented and stable.

## Decision

Parse OTLP JSON using `serde_json` with hand-written Rust structs matching the minimal subset of the OTLP JSON logs schema. No new dependencies.

The structs cover:
- `ExportLogsServiceRequest` (top-level, contains `resourceLogs`)
- `ResourceLogs` (contains `resource` and `scopeLogs`)
- `ScopeLogs` (contains `logRecords`)
- `LogRecord` (contains `body`, `attributes`, `timeUnixNano`, `severityNumber`)
- `OtelAttribute` / `OtelAttributeValue` (key-value with typed value union: `stringValue`, `intValue`, `doubleValue`, `boolValue`)

A generic envelope parser handles the shared structure. Per-event-type extractors validate required attributes and produce typed payloads.

## Alternatives Considered

### A: opentelemetry-proto crate
- Full OTLP type definitions generated from protobuf schemas
- Supports both JSON and protobuf deserialization
- **Rejected**: Adds `opentelemetry-proto` + `prost` + `prost-types` dependencies (+2-5MB binary). Provides hundreds of types when we need ~6. Protobuf support not needed (norbert-cc-plugin configures `http/json`).

### B: Raw serde_json::Value traversal
- No structs, navigate JSON with `.get()` chains
- **Rejected**: Fragile, no compile-time type safety, verbose error handling. Each attribute access requires 3-4 chained `.get()/.as_str()` calls with no IDE support. With 5 event types and ~30 total attributes, this becomes unmaintainable.

### C: Hand-written serde structs (selected)
- ~60 lines of struct definitions with `#[serde(rename_all = "camelCase")]`
- Type-safe deserialization with clear error messages
- Zero new dependencies (serde_json already in Cargo.toml)
- Generic parser + per-event-type extractors keeps each event type clean

## Consequences

- **Positive**: Zero binary size impact. Zero new dependencies to audit or update.
- **Positive**: Type-safe parsing with compile-time field checking. Clear struct definitions serve as living documentation of the OTLP subset used.
- **Positive**: Generic envelope parser handles all 5 event types uniformly. Per-event-type extractors are small, focused pure functions.
- **Negative**: If OTLP JSON schema changes significantly, structs need manual update. Mitigated: the schema is an OpenTelemetry standard with strong backward compatibility commitments.
- **Negative**: If protobuf support is later needed, these structs do not help. Mitigated: the parser module boundary isolates this -- swap implementation without affecting callers.
