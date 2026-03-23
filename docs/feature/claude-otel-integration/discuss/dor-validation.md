# Definition of Ready Validation

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23 (updated from 2026-03-20 with research corrections)
**Research Reference**: `docs/research/claude-code-otel-telemetry-actual-emissions.md`

---

## US-COI-001: Receive OTel Event Data via OTLP Endpoint

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Marco Rossi finds it frustrating that token data arrives 3-9 seconds late because Norbert polls transcript JSONL files" -- specific pain, domain language, measurable lag |
| User/persona identified | PASS | Marco Rossi, developer using Norbert to monitor Claude Code costs in real-time |
| 3+ domain examples | PASS | 5 examples: happy path (Sonnet session), zero cache tokens, missing attributes, non-Claude log records, malformed JSON |
| UAT scenarios (3-7) | PASS | 5 scenarios in Given/When/Then with concrete data |
| AC derived from UAT | PASS | 9 acceptance criteria, each traceable to scenarios |
| Right-sized (1-3 days) | PASS | Estimated 2-3 days: add route + parser + mapper + tests |
| Technical notes | PASS | Dependencies (serde_json), ExportLogsServiceRequest structure, session.id extraction from log record attributes, norbert-cc-plugin auto-configuration |
| Dependencies tracked | PASS | Depends on US-COI-004 (ApiRequest event type), US-COI-005 (session ID extraction) |

### DoR Status: PASSED

---

## US-COI-002: Display OTel-Reported Cost from cost_usd

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it unreliable that Norbert estimates costs using a local pricing table that can drift" -- specific pain point. Corrected: cost_usd is "estimated" per Anthropic docs, not authoritative billing |
| User/persona identified | PASS | Marco Rossi, developer tracking AI spend with active OTel session |
| 3+ domain examples | PASS | 3 examples: OTel-reported cost, pricing model fallback, zero cost |
| UAT scenarios (3-7) | PASS | 3 scenarios with concrete data (cost_usd=0.042, model names, token counts) |
| AC derived from UAT | PASS | 4 acceptance criteria derived from scenarios |
| Right-sized (1-3 days) | PASS | Estimated 1 day: conditional cost extraction in metricsAggregator |
| Technical notes | PASS | tokenExtractor or new step checks cost_usd, pricingModel unchanged. cost_usd is estimated, not authoritative billing. |
| Dependencies tracked | PASS | Depends on US-COI-001 (OTel data must be flowing) |

### DoR Status: PASSED

---

## US-COI-003: Suppress Transcript Polling for OTel-Active Sessions

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it confusing when Norbert shows inflated token counts because both OTel and transcript polling are feeding data" -- specific duplication problem |
| User/persona identified | PASS | Marco Rossi, developer with OTel enabled, expects non-duplicate metrics |
| 3+ domain examples | PASS | 3 examples: OTel-active skip, non-OTel continue, mixed sessions |
| UAT scenarios (3-7) | PASS | 4 scenarios including mixed sessions and first-event detection |
| AC derived from UAT | PASS | 5 acceptance criteria covering flag tracking, polling suppression, transition |
| Right-sized (1-3 days) | PASS | Estimated 1 day: per-session flag check in transcript polling logic |
| Technical notes | PASS | Flag derived from ApiRequest count, polling logic in App.tsx:270-325 |
| Dependencies tracked | PASS | Depends on US-COI-001 (ApiRequest events must be flowing) |

### DoR Status: PASSED

---

## US-COI-004: New ApiRequest Event Type in Domain Model

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds that the current EventType enum has six variants but none representing an API request" -- specific gap in domain model |
| User/persona identified | PASS | Marco Rossi as Norbert developer extending the domain model |
| 3+ domain examples | PASS | 3 examples: serialization, deserialization, existing types unaffected |
| UAT scenarios (3-7) | PASS | 3 scenarios covering serialize, deserialize, regression safety |
| AC derived from UAT | PASS | 5 acceptance criteria including compiler-enforced exhaustive matches |
| Right-sized (1-3 days) | PASS | Estimated 0.5 day: add enum variant + update matches + tests |
| Technical notes | PASS | Detailed notes on test updates, HOOK_EVENT_NAMES exclusion, parse_event_type non-mapping |
| Dependencies tracked | PASS | No dependencies. Blocks US-COI-001 |

### DoR Status: PASSED

---

## US-COI-005: OTel Session Identity Resolution

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it problematic when OTel events arrive with a session identifier that does not match" -- specific fragmentation problem. Research confirmed: attribute is `session.id` (dot-separated), standard attribute on log records. |
| User/persona identified | PASS | Marco Rossi, developer with both hooks and OTel, expects unified session view |
| 3+ domain examples | PASS | 3 examples: matching IDs, OTel-first session creation, missing session.id |
| UAT scenarios (3-7) | PASS | 3 scenarios covering ID matching, session creation, missing session.id handling |
| AC derived from UAT | PASS | 4 acceptance criteria covering extraction from log record attributes, session creation, missing ID |
| Right-sized (1-3 days) | PASS | Estimated 0.5-1 day: research resolved the uncertainty (session.id confirmed as log record attribute) |
| Technical notes | PASS | session.id is dot-separated standard attribute on all events (not resource attribute). No spike needed -- research confirmed. |
| Dependencies tracked | PASS | Depends on US-COI-004. Blocks US-COI-001. |

### DoR Status: PASSED

---

## US-COI-006: Ingest User Prompt Events from OTel

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it difficult to correlate cost spikes with specific prompts because Norbert only receives API request data" -- specific visibility gap |
| User/persona identified | PASS | Marco Rossi, developer wanting prompt-level visibility into session activity |
| 3+ domain examples | PASS | 3 examples: prompt captured with length, prompt content when opted in, prompt content redacted by default |
| UAT scenarios (3-7) | PASS | 3 scenarios: prompt length captured, prompt content stored, missing prompt_length drops log record |
| AC derived from UAT | PASS | 6 acceptance criteria covering UserPrompt variant, extraction, required/optional attributes, session linking, prompt.id correlation |
| Right-sized (1-3 days) | PASS | Estimated 0.5-1 day: follows established pattern from US-COI-001 parser |
| Technical notes | PASS | prompt.id enables cross-event correlation, privacy considerations for prompt content, future feature enablement |
| Dependencies tracked | PASS | Depends on US-COI-001 (OTLP endpoint), US-COI-004 (EventType pattern) |

### DoR Status: PASSED

---

## US-COI-007: Ingest Tool Result Events from OTel

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "She finds it difficult to identify which tools are slow or failing because Norbert only shows hook-level tool start/end events" -- specific limitation of current hook events |
| User/persona identified | PASS | Ayumi Tanaka, developer with multiple MCP servers and tools wanting performance visibility |
| 3+ domain examples | PASS | 3 examples: successful tool execution, MCP server metadata, tool execution failure |
| UAT scenarios (3-7) | PASS | 4 scenarios: success, failure with error, missing tool_name, MCP metadata preserved |
| AC derived from UAT | PASS | 6 acceptance criteria covering ToolResult variant, extraction, required/optional attributes, MCP metadata, session linking |
| Right-sized (1-3 days) | PASS | Estimated 0.5-1 day: follows established pattern from US-COI-001 parser |
| Technical notes | PASS | Richer than ToolCallEnd hook events, privacy for tool_parameters, future feature enablement |
| Dependencies tracked | PASS | Depends on US-COI-001 (OTLP endpoint), US-COI-004 (EventType pattern) |

### DoR Status: PASSED

---

## US-COI-008: Ingest API Error Events from OTel

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it frustrating when API calls fail silently -- he only notices when output stops appearing" -- specific pain with silent API failures |
| User/persona identified | PASS | Marco Rossi, developer running long sessions wanting API failure visibility |
| 3+ domain examples | PASS | 3 examples: rate limit error, retry attempt, connection timeout without status code |
| UAT scenarios (3-7) | PASS | 3 scenarios: rate limit captured, connection timeout, missing error attribute |
| AC derived from UAT | PASS | 5 acceptance criteria covering ApiError variant, extraction, required/optional attributes, session linking |
| Right-sized (1-3 days) | PASS | Estimated 0.5-1 day: follows established pattern from US-COI-001 parser |
| Technical notes | PASS | Complements api_request events, attempt enables retry tracking, speed indicates API tier |
| Dependencies tracked | PASS | Depends on US-COI-001 (OTLP endpoint), US-COI-004 (EventType pattern) |

### DoR Status: PASSED

---

## US-COI-009: Ingest Tool Decision Events from OTel

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "She finds it opaque when tools are silently blocked or auto-approved" -- specific pain with tool permission opacity |
| User/persona identified | PASS | Ayumi Tanaka, developer with tool permission policies wanting decision visibility |
| 3+ domain examples | PASS | 3 examples: tool auto-approved by policy, tool rejected interactively, unknown decision source (forward compat) |
| UAT scenarios (3-7) | PASS | 3 scenarios: allow captured, deny captured, missing tool_name drops record |
| AC derived from UAT | PASS | 6 acceptance criteria covering ToolDecision variant, extraction, required/optional attributes, forward compatibility, session linking |
| Right-sized (1-3 days) | PASS | Estimated 0.5 day: follows established pattern, simplest event type |
| Technical notes | PASS | Store values as strings for forward compatibility, pairs with tool_result events |
| Dependencies tracked | PASS | Depends on US-COI-001 (OTLP endpoint), US-COI-004 (EventType pattern) |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Estimated Effort | Priority |
|-------|-----------|-----------------|----------|
| US-COI-004 | PASSED | 0.5 day | Must Have (prerequisite) |
| US-COI-005 | PASSED | 0.5-1 day | Must Have (prerequisite) |
| US-COI-001 | PASSED | 2-3 days | Must Have (core) |
| US-COI-002 | PASSED | 1 day | Should Have |
| US-COI-003 | PASSED | 1 day | Must Have |
| US-COI-006 | PASSED | 0.5-1 day | Should Have |
| US-COI-007 | PASSED | 0.5-1 day | Should Have |
| US-COI-008 | PASSED | 0.5-1 day | Should Have |
| US-COI-009 | PASSED | 0.5 day | Could Have |

**Total estimated effort**: 7-10 days

### Recommended Implementation Order

```
US-COI-004 (EventType variants -- ApiRequest + 4 new)
    |
    v
US-COI-005 (Session ID resolution -- session.id attribute)
    |
    v
US-COI-001 (OTLP /v1/logs endpoint + api_request parser)
    |
    +---> US-COI-002 (OTel-reported cost)
    |
    +---> US-COI-003 (Transcript polling suppression)
    |
    +---> US-COI-006 (User prompt events)
    |
    +---> US-COI-007 (Tool result events)
    |
    +---> US-COI-008 (API error events)
    |
    +---> US-COI-009 (Tool decision events)
```

All 9 stories pass the 8-item DoR hard gate. Ready for DESIGN wave handoff.
