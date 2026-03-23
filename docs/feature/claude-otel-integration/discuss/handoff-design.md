# DESIGN Wave Handoff: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**From**: DISCUSS wave (product-owner)
**To**: DESIGN wave (solution-architect)
**Date**: 2026-03-23 (updated from 2026-03-20 with research corrections)
**Status**: APPROVED for handoff
**Research Reference**: `docs/research/claude-code-otel-telemetry-actual-emissions.md`

---

## Business Context

Norbert's real-time monitoring value proposition is undermined by 3-9 second token data latency caused by transcript JSONL file polling. Claude Code natively exports token usage, cost, prompt, tool execution, API error, and tool decision data via OpenTelemetry **logs protocol** (not traces). This feature adds an OTLP/HTTP log receiver to the existing hook receiver infrastructure, enabling sub-second data delivery for all 5 event types.

**Critical correction (2026-03-23)**: Research confirmed that Claude Code sends **OTel logs** (ExportLogsServiceRequest to `/v1/logs`), not traces (ExportTraceServiceRequest to `/v1/traces`). All artifacts have been updated accordingly. The attribute `session.id` (dot-separated) is a standard attribute on log records, not `session_id` (underscore) in resource attributes.

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Token data latency | 3-9 seconds | <500ms |
| Data gap rate | Unknown (silent failures) | 0% |
| Cost accuracy | Estimated (local pricing table) | OTel-reported (cost_usd from Anthropic, described as "estimated") |
| Event type coverage | 0 OTel event types | 5 event types (api_request, user_prompt, tool_result, api_error, tool_decision) |
| Transcript polling LoC | ~140 lines | 0 lines (after full migration, future) |

---

## Deliverables

### Journey Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Journey Schema | `discuss/journey-otel-ingestion.yaml` | Structured 6-step journey with emotional arc, shared artifacts, integration checkpoints |
| Journey Visual | `discuss/journey-otel-ingestion-visual.md` | ASCII data flow diagram, emotional arc, step details, error paths |
| Gherkin Scenarios | `discuss/journey-otel-ingestion.feature` | Acceptance scenarios including happy paths, edge cases, errors, new event types, and 1 property test |
| Shared Artifacts Registry | `discuss/shared-artifacts-registry.md` | Tracked artifacts with sources, consumers, risk levels, and 7 integration checkpoints |

### Requirements

| Artifact | Path | Description |
|----------|------|-------------|
| User Stories | `discuss/user-stories.md` | 9 stories (all DoR PASSED) |
| DoR Validation | `discuss/dor-validation.md` | 8-item validation per story, all PASSED |
| Peer Review | `discuss/peer-review.md` | Review approved, 0 critical/high issues (original 5 stories; new stories follow same pattern) |

### Research

| Artifact | Path | Description |
|----------|------|-------------|
| OTel Telemetry Research | `docs/research/claude-code-otel-telemetry-actual-emissions.md` | Comprehensive research on actual Claude Code OTel emissions, correcting trace-to-logs assumption |

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
| US-COI-005 | OTel Session Identity Resolution | Must Have | 0.5-1 day | US-COI-004 |
| US-COI-001 | Receive OTel Event Data via OTLP Endpoint | Must Have | 2-3 days | US-COI-004, US-COI-005 |
| US-COI-002 | Display OTel-Reported Cost from cost_usd | Should Have | 1 day | US-COI-001 |
| US-COI-003 | Suppress Transcript Polling for OTel-Active Sessions | Must Have | 1 day | US-COI-001 |
| US-COI-006 | Ingest User Prompt Events from OTel | Should Have | 0.5-1 day | US-COI-001, US-COI-004 |
| US-COI-007 | Ingest Tool Result Events from OTel | Should Have | 0.5-1 day | US-COI-001, US-COI-004 |
| US-COI-008 | Ingest API Error Events from OTel | Should Have | 0.5-1 day | US-COI-001, US-COI-004 |
| US-COI-009 | Ingest Tool Decision Events from OTel | Could Have | 0.5 day | US-COI-001, US-COI-004 |

**Total estimated effort**: 7-10 days

### Implementation Order

```
US-COI-004 --> US-COI-005 --> US-COI-001 --> US-COI-002
                                         --> US-COI-003
                                         --> US-COI-006
                                         --> US-COI-007
                                         --> US-COI-008
                                         --> US-COI-009
```

---

## Architecture-Significant Decisions for DESIGN Wave

The following decisions were intentionally left open for the solution-architect:

1. **OTLP JSON vs Protobuf**: MVP uses JSON-only (via `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`). Protobuf support decision deferred to DESIGN.
2. **Rust crate selection**: `serde_json` (already present) vs `opentelemetry-proto` vs manual struct definitions for ExportLogsServiceRequest parsing.
3. **Event payload normalization**: Whether to normalize in Rust (before persistence) or TypeScript (before metrics aggregation).
4. **Database schema changes**: Whether new event types need new columns or fit in existing event table as-is.
5. **Generic vs specific event parsers**: Whether to implement a generic log record parser with event-type-specific attribute extractors, or separate handlers per event type.
6. **prompt.id correlation**: How to surface prompt-to-api-request correlation in the frontend (US-COI-006 enables the data; presentation is a DESIGN decision).

---

## Non-Functional Requirements

| NFR | Requirement | Source |
|-----|------------|--------|
| Latency | Token data from OTel appears in charts within 500ms | Journey step 5, property scenario |
| Binary size | OTLP parsing dependencies add less than 5MB to binary | DISCOVER solution-testing |
| Privacy | OTel data never leaves localhost (127.0.0.1 only) | DISCOVER lean-canvas, assumption A2 |
| Backward compatibility | Transcript polling continues for non-OTel sessions | US-COI-003 |
| Resilience | Malformed OTLP payloads return 400 without crashing | US-COI-001 scenario 5 |
| Forward compatibility | Unrecognized event names silently ignored | US-COI-001, Gherkin error paths |

---

## Risk Assessment

| Risk | Category | Probability | Impact | Mitigation |
|------|----------|-------------|--------|------------|
| Claude Code changes OTel event schema | Technical | Medium | Medium | Version-detect schema, log unknown event names, graceful degradation |
| Session ID format mismatch between hooks and OTel | Technical | Low (research confirmed format) | High | Research confirmed `session.id` as standard attribute; parser extracts from log record attributes |
| Binary size exceeds budget | Technical | Low | Low | Start with JSON-only, defer protobuf |
| Users don't enable OTel env vars | Project | Medium | Medium | norbert-cc-plugin auto-configures; transcript fallback ensures zero regression |
| Port conflict on 3748 | Technical | Low | Low | Already handled by existing hook receiver startup |
| New event types overwhelm EventStore | Technical | Low | Medium | Events are small; monitor table growth in practice |

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| OTLP | OpenTelemetry Protocol -- standard wire format for telemetry data |
| OTLP/HTTP | OTLP transported over HTTP (as opposed to gRPC) |
| ExportLogsServiceRequest | The top-level OTLP message containing log record data (sent to `/v1/logs`) |
| Log record | An OTel log record -- the transport unit for Claude Code events. Contains a body, attributes, timestamp, and severity. |
| event.name | Attribute on a log record identifying the event type (e.g., `api_request`, `user_prompt`) |
| claude_code.api_request | An OTel event name for an API call with token usage data |
| claude_code.user_prompt | An OTel event name for when a user submits a prompt |
| claude_code.tool_result | An OTel event name for when a tool completes execution |
| claude_code.api_error | An OTel event name for when an API request fails |
| claude_code.tool_decision | An OTel event name for when a tool permission decision is made |
| session.id | Standard attribute (dot-separated) on all Claude Code OTel events identifying the session |
| prompt.id | UUID v4 attribute linking all events from a single user prompt |
| ApiRequest | Canonical EventType in Norbert's domain model representing an API call with token usage |
| cost_usd | OTel-reported estimated per-request cost from Anthropic, carried as a log record attribute |
| otelActive | Per-session flag indicating whether OTel data has been received (triggers transcript polling suppression) |
| Hook receiver | Existing axum HTTP server on port 3748 that accepts Claude Code hook POST events |
| norbert-cc-plugin | Claude Code plugin that auto-configures OTel environment variables in settings.json |

---

## Handoff Checklist

- [x] All user stories pass DoR (8/8 items per story, 9 stories)
- [x] Peer review approved (0 critical, 0 high issues for original stories; new stories follow validated pattern)
- [x] Journey artifacts complete (YAML, visual, Gherkin, shared artifacts registry)
- [x] Integration checkpoints defined (7 checkpoints in shared artifacts registry)
- [x] Non-functional requirements specified with measurable thresholds
- [x] Risks identified and categorized
- [x] Dependencies mapped and acyclic
- [x] Architecture decisions left open for DESIGN wave
- [x] Domain glossary included
- [x] Research corrections applied (logs not traces, session.id not session_id, cost_usd is estimated)
