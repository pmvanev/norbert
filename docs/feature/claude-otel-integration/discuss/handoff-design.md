# DESIGN Wave Handoff: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**From**: DISCUSS wave (product-owner)
**To**: DESIGN wave (solution-architect)
**Date**: 2026-03-20
**Status**: APPROVED for handoff

---

## Business Context

Norbert's real-time monitoring value proposition is undermined by 3-9 second token data latency caused by transcript JSONL file polling. Claude Code natively exports token usage, cost, and model data via OpenTelemetry. This feature adds an OTLP/HTTP receiver to the existing hook receiver infrastructure, enabling sub-second data delivery.

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Token data latency | 3-9 seconds | <500ms |
| Data gap rate | Unknown (silent failures) | 0% |
| Cost accuracy | Estimated (local pricing table) | Authoritative (cost_usd from Anthropic) |
| Transcript polling LoC | ~140 lines | 0 lines (after full migration, future) |

---

## Deliverables

### Journey Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Journey Schema | `discuss/journey-otel-ingestion.yaml` | Structured 6-step journey with emotional arc, shared artifacts, integration checkpoints |
| Journey Visual | `discuss/journey-otel-ingestion-visual.md` | ASCII data flow diagram, emotional arc, step details, error paths |
| Gherkin Scenarios | `discuss/journey-otel-ingestion.feature` | 18 acceptance scenarios including happy paths, edge cases, errors, and 1 property test |
| Shared Artifacts Registry | `discuss/shared-artifacts-registry.md` | 9 tracked artifacts with sources, consumers, risk levels, and 5 integration checkpoints |

### Requirements

| Artifact | Path | Description |
|----------|------|-------------|
| User Stories | `discuss/user-stories.md` | 5 stories (all DoR PASSED) |
| DoR Validation | `discuss/dor-validation.md` | 8-item validation per story, all PASSED |
| Peer Review | `discuss/peer-review.md` | Review approved, 0 critical/high issues |

### DISCOVER Artifacts (upstream context)

| Artifact | Path |
|----------|------|
| Problem Validation | `discover/problem-validation.md` |
| Opportunity Tree | `discover/opportunity-tree.md` |
| Solution Testing | `discover/solution-testing.md` |
| Lean Canvas | `discover/lean-canvas.md` |

---

## User Stories Summary

| ID | Title | Priority | Effort | Dependencies |
|----|-------|----------|--------|-------------|
| US-COI-004 | New ApiRequest Event Type in Domain Model | Must Have | 0.5 day | None |
| US-COI-005 | OTel Session Identity Resolution | Must Have | 1-2 days | US-COI-004 |
| US-COI-001 | Receive OTel Token Data via OTLP Endpoint | Must Have | 2-3 days | US-COI-004, US-COI-005 |
| US-COI-002 | Display Authoritative Cost from OTel cost_usd | Should Have | 1 day | US-COI-001 |
| US-COI-003 | Suppress Transcript Polling for OTel-Active Sessions | Must Have | 1 day | US-COI-001 |

**Total estimated effort**: 5.5-7.5 days

### Implementation Order

```
US-COI-004 --> US-COI-005 --> US-COI-001 --> US-COI-002
                                         --> US-COI-003
```

---

## Architecture-Significant Decisions for DESIGN Wave

The following decisions were intentionally left open for the solution-architect:

1. **OTLP JSON vs Protobuf**: MVP uses JSON-only. Protobuf support decision deferred to DESIGN.
2. **Rust crate selection**: `serde_json` (already present) vs `opentelemetry-proto` vs manual struct definitions.
3. **Session ID extraction strategy**: Where exactly Claude Code places session_id in OTel spans (resource attributes vs span attributes) -- spike may be needed.
4. **Event payload normalization**: Whether to normalize in Rust (before persistence) or TypeScript (before metrics aggregation).
5. **Database schema changes**: Whether `ApiRequest` events need new columns or fit in existing event table as-is.

---

## Non-Functional Requirements

| NFR | Requirement | Source |
|-----|------------|--------|
| Latency | Token data from OTel appears in charts within 500ms | Journey step 5, property scenario |
| Binary size | OTLP parsing dependencies add less than 5MB to binary | DISCOVER solution-testing |
| Privacy | OTel data never leaves localhost (127.0.0.1 only) | DISCOVER lean-canvas, assumption A2 |
| Backward compatibility | Transcript polling continues for non-OTel sessions | US-COI-003 |
| Resilience | Malformed OTLP payloads return 400 without crashing | US-COI-001 scenario 5 |

---

## Risk Assessment

| Risk | Category | Probability | Impact | Mitigation |
|------|----------|-------------|--------|------------|
| Claude Code changes OTel span schema | Technical | Medium | Medium | Version-detect schema, log unknown span names, graceful degradation |
| Session ID format mismatch between hooks and OTel | Technical | Medium | High | US-COI-005 spike to verify, normalization function if needed |
| Binary size exceeds budget | Technical | Low | Low | Start with JSON-only, defer protobuf |
| Users don't enable OTel env vars | Project | Medium | Medium | Transcript fallback ensures zero regression; setup wizard in future |
| Port conflict on 3748 | Technical | Low | Low | Already handled by existing hook receiver startup |

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| OTLP | OpenTelemetry Protocol -- standard wire format for telemetry data |
| OTLP/HTTP | OTLP transported over HTTP (as opposed to gRPC) |
| ExportTraceServiceRequest | The top-level OTLP message containing trace/span data |
| claude_code.api_request | The OTel span name emitted by Claude Code for each API call |
| ApiRequest | New canonical EventType in Norbert's domain model representing an API call with token usage |
| cost_usd | Authoritative per-request cost from Anthropic's billing, carried as an OTel span attribute |
| otelActive | Per-session flag indicating whether OTel data has been received (triggers transcript polling suppression) |
| Hook receiver | Existing axum HTTP server on port 3748 that accepts Claude Code hook POST events |

---

## Handoff Checklist

- [x] All user stories pass DoR (8/8 items per story)
- [x] Peer review approved (0 critical, 0 high issues)
- [x] Journey artifacts complete (YAML, visual, Gherkin, shared artifacts registry)
- [x] Integration checkpoints defined (5 checkpoints in shared artifacts registry)
- [x] Non-functional requirements specified with measurable thresholds
- [x] Risks identified and categorized
- [x] Dependencies mapped and acyclic
- [x] Architecture decisions left open for DESIGN wave
- [x] Domain glossary included
