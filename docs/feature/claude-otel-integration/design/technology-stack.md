# Technology Stack: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-20

---

## No New Dependencies Required

This feature requires **zero new crate or npm dependencies**. All parsing and mapping is accomplished with existing dependencies.

| Existing Dependency | Version | License | Role in This Feature |
|---------------------|---------|---------|----------------------|
| `serde_json` | 1.x | MIT/Apache-2.0 | Parse OTLP/HTTP JSON body into Rust structs |
| `serde` (derive) | 1.x | MIT/Apache-2.0 | Deserialize OTLP JSON into typed structs |
| `axum` | 0.7.x | MIT | HTTP route handler for `/v1/traces` |
| `chrono` | 0.4.x | MIT/Apache-2.0 | Timestamp generation for received_at |
| `rusqlite` | 0.31.x | MIT | Event persistence (existing EventStore) |

---

## Decision: serde_json Over opentelemetry-proto

### Considered Alternatives

| Option | Binary Size Impact | New Dependencies | Complexity |
|--------|-------------------|------------------|------------|
| **A: serde_json (selected)** | 0 KB (already present) | 0 | Low -- hand-write 4 structs matching OTLP JSON subset |
| B: opentelemetry-proto | +2-5 MB | opentelemetry-proto, prost, prost-types | Medium -- full OTLP type system, protobuf support |
| C: opentelemetry-rust SDK | +3-8 MB | opentelemetry, opentelemetry-otlp, tonic | High -- brings full OTel pipeline abstractions |

### Rationale

Norbert needs to parse exactly one span type (`claude_code.api_request`) and extract 6 attributes. The OTLP JSON format is a straightforward nested JSON structure. Hand-writing 4 serde structs (`ExportTraceServiceRequest`, `ResourceSpans`, `ScopeSpans`, `Span`) takes ~50 lines and adds zero binary size.

Option B would add protobuf support (not needed since we only accept JSON) and pull in the full OTLP type hierarchy. Option C brings collector/exporter abstractions designed for OTel backends, not for extracting a handful of attributes.

### Future Migration Path

If protobuf support is later needed (Claude Code sends HTTP/Protobuf), add `opentelemetry-proto` + `prost` at that time. The parser module boundary isolates this decision -- swapping the internal implementation does not affect the handler or domain layers.

---

## Frontend: No New Dependencies

The frontend changes are limited to:
- Adding `api_request` to the event handler dispatch table in `metricsAggregator.ts`
- Adding `cost_usd` bypass logic (conditional check on a field)
- Adding otelActive detection in transcript polling logic

All changes use existing TypeScript/React patterns. No new npm packages.
