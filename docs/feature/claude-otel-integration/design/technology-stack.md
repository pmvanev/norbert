# Technology Stack: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23 (corrected from 2026-03-20)

---

## No New Dependencies Required

This feature requires **zero new crate or npm dependencies**. All parsing and mapping is accomplished with existing dependencies.

| Existing Dependency | Version | License | Role in This Feature |
|---------------------|---------|---------|----------------------|
| `serde_json` | 1.x | MIT/Apache-2.0 | Parse OTLP/HTTP JSON body (`ExportLogsServiceRequest`) into Rust structs |
| `serde` (derive) | 1.x | MIT/Apache-2.0 | Deserialize OTLP JSON into typed structs |
| `axum` | 0.7.x | MIT | HTTP route handler for `/v1/logs` |
| `chrono` | 0.4.x | MIT/Apache-2.0 | Timestamp generation for received_at |
| `rusqlite` | 0.31.x | MIT | Event persistence (existing EventStore) |

---

## Decision: serde_json Over opentelemetry-proto

### Considered Alternatives

| Option | Binary Size Impact | New Dependencies | Complexity |
|--------|-------------------|------------------|------------|
| **A: serde_json (selected)** | 0 KB (already present) | 0 | Low -- hand-write structs matching OTLP JSON subset |
| B: opentelemetry-proto | +2-5 MB | opentelemetry-proto, prost, prost-types | Medium -- full OTLP type system, protobuf support |
| C: opentelemetry-rust SDK | +3-8 MB | opentelemetry, opentelemetry-otlp, tonic | High -- brings full OTel pipeline abstractions |

### Rationale

Norbert needs to parse 5 event types from `ExportLogsServiceRequest` and extract type-specific attributes. The OTLP JSON format is a straightforward nested JSON structure. Hand-writing serde structs for the logs envelope (`ExportLogsServiceRequest`, `ResourceLogs`, `ScopeLogs`, `LogRecord`, `OtelAttribute`, `OtelAttributeValue`) takes ~60 lines and adds zero binary size. The per-event-type extractors are pure functions operating on the parsed attribute map.

Option B would add protobuf support (not needed since norbert-cc-plugin configures `http/json`) and pull in the full OTLP type hierarchy. Option C brings collector/exporter abstractions designed for OTel backends, not for extracting attributes from log records.

### Future Migration Path

If protobuf support is later needed (user sends HTTP/Protobuf), add `opentelemetry-proto` + `prost` at that time. The parser module boundary isolates this decision -- swapping the internal implementation does not affect the handler or domain layers.

---

## Frontend: No New Dependencies

The frontend changes are limited to:
- Adding 5 new event types to the `metricsAggregator.ts` dispatch table (`api_request` with token/cost handling; 4 others as identity handlers)
- Adding `cost_usd` bypass logic (conditional check on a field)
- Adding otelActive detection in transcript polling logic

All changes use existing TypeScript/React patterns. No new npm packages.
