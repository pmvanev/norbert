# ADR-031: OTLP JSON Parsing Strategy

## Status

Accepted

## Context

The OTLP/HTTP endpoint needs to parse `ExportTraceServiceRequest` payloads. Three approaches were considered for parsing the OTLP format in Rust: using the `opentelemetry-proto` crate with full protobuf type definitions, using `serde_json` with hand-written structs matching the JSON subset, or using raw `serde_json::Value` traversal without typed structs.

Norbert needs to extract exactly one span type (`claude_code.api_request`) and read 6 attributes from it. The OTLP JSON structure is well-documented and stable.

## Decision

Parse OTLP JSON using `serde_json` with hand-written Rust structs matching the minimal subset of the OTLP JSON schema. No new dependencies.

The structs cover:
- `ExportTraceServiceRequest` (top-level, contains `resourceSpans`)
- `ResourceSpans` (contains `resource` and `scopeSpans`)
- `ScopeSpans` (contains `spans`)
- `Span` (contains `name` and `attributes`)
- `OtelAttribute` / `OtelAttributeValue` (key-value with typed value union)

## Alternatives Considered

### A: opentelemetry-proto crate
- Full OTLP type definitions generated from protobuf schemas
- Supports both JSON and protobuf deserialization
- **Rejected**: Adds `opentelemetry-proto` + `prost` + `prost-types` dependencies (+2-5MB binary). Provides hundreds of types when we need 5. Protobuf support not needed (JSON-only MVP).

### B: Raw serde_json::Value traversal
- No structs, navigate JSON with `.get()` chains
- **Rejected**: Fragile, no compile-time type safety, verbose error handling. Each attribute access requires 3-4 chained `.get()/.as_str()` calls with no IDE support.

### C: Hand-written serde structs (selected)
- ~50 lines of struct definitions with `#[serde(rename_all = "camelCase")]`
- Type-safe deserialization with clear error messages
- Zero new dependencies (serde_json already in Cargo.toml)

## Consequences

- **Positive**: Zero binary size impact. Zero new dependencies to audit or update.
- **Positive**: Type-safe parsing with compile-time field checking. Clear struct definitions serve as living documentation of the OTLP subset used.
- **Negative**: If OTLP JSON schema changes significantly, structs need manual update. Mitigated: the schema is an OpenTelemetry standard with strong backward compatibility commitments.
- **Negative**: If protobuf support is later needed, these structs do not help. Mitigated: the parser module boundary isolates this -- swap implementation without affecting callers.
