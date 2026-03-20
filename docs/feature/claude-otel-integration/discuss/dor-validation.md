# Definition of Ready Validation

**Feature ID**: claude-otel-integration
**Date**: 2026-03-20

---

## US-COI-001: Receive OTel Token Data via OTLP Endpoint

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Marco Rossi finds it frustrating that token data arrives 3-9 seconds late because Norbert polls transcript JSONL files" -- specific pain, domain language, measurable lag |
| User/persona identified | PASS | Marco Rossi, developer using Norbert to monitor Claude Code costs in real-time |
| 3+ domain examples | PASS | 5 examples: happy path (Sonnet session), zero cache tokens, missing attributes, non-Claude spans, malformed JSON |
| UAT scenarios (3-7) | PASS | 5 scenarios in Given/When/Then with concrete data |
| AC derived from UAT | PASS | 9 acceptance criteria, each traceable to scenarios |
| Right-sized (1-3 days) | PASS | Estimated 2-3 days: add route + parser + mapper + tests |
| Technical notes | PASS | Dependencies (serde_json, opentelemetry-proto), session ID strategy, exhaustive match updates |
| Dependencies tracked | PASS | Depends on US-COI-004 (ApiRequest event type), US-COI-005 (session ID extraction) |

### DoR Status: PASSED

---

## US-COI-002: Display Authoritative Cost from OTel cost_usd

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "He finds it unreliable that Norbert estimates costs using a local pricing table that can drift" -- specific pain point |
| User/persona identified | PASS | Marco Rossi, developer tracking AI spend with active OTel session |
| 3+ domain examples | PASS | 3 examples: authoritative cost, pricing model fallback, zero cost |
| UAT scenarios (3-7) | PASS | 3 scenarios with concrete data (cost_usd=0.042, model names, token counts) |
| AC derived from UAT | PASS | 4 acceptance criteria derived from scenarios |
| Right-sized (1-3 days) | PASS | Estimated 1 day: conditional cost extraction in metricsAggregator |
| Technical notes | PASS | tokenExtractor or new step checks cost_usd, pricingModel unchanged |
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
| Problem statement clear | PASS | "He finds it problematic when OTel events arrive with a session identifier that does not match" -- specific fragmentation problem |
| User/persona identified | PASS | Marco Rossi, developer with both hooks and OTel, expects unified session view |
| 3+ domain examples | PASS | 3 examples: matching IDs, OTel-first session creation, ID format mismatch |
| UAT scenarios (3-7) | PASS | 3 scenarios covering ID matching, session creation, attribute location handling |
| AC derived from UAT | PASS | 4 acceptance criteria covering extraction, session creation, attribute locations, missing ID |
| Right-sized (1-3 days) | PASS | Estimated 1-2 days: investigation + extraction logic + tests |
| Technical notes | PASS | Spike candidate, possible locations (service.instance.id, span attribute), normalization may be needed |
| Dependencies tracked | PASS | Depends on US-COI-004. Blocks US-COI-001. |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Estimated Effort | Priority |
|-------|-----------|-----------------|----------|
| US-COI-004 | PASSED | 0.5 day | Must Have (prerequisite) |
| US-COI-005 | PASSED | 1-2 days | Must Have (prerequisite) |
| US-COI-001 | PASSED | 2-3 days | Must Have (core) |
| US-COI-002 | PASSED | 1 day | Should Have |
| US-COI-003 | PASSED | 1 day | Must Have |

**Total estimated effort**: 5.5-7.5 days

### Recommended Implementation Order

```
US-COI-004 (ApiRequest event type)
    |
    v
US-COI-005 (Session ID resolution)
    |
    v
US-COI-001 (OTLP endpoint + parser)
    |
    +---> US-COI-002 (Authoritative cost)
    |
    +---> US-COI-003 (Transcript polling suppression)
```

All 5 stories pass the 8-item DoR hard gate. Ready for DESIGN wave handoff.
