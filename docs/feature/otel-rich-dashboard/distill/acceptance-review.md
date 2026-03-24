# Acceptance Test Review: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Review Date**: 2026-03-24
**Reviewer**: Quinn (acceptance-designer, review mode)

---

## Review Summary

```yaml
review_id: "accept_rev_20260324_otel_rich_dashboard"
reviewer: "acceptance-designer (review mode)"

strengths:
  - "All 8 user stories have dedicated scenario coverage with concrete examples"
  - "Error path ratio of 46.8% exceeds 40% target -- error and edge cases are well represented"
  - "Walking skeletons express user goals ('Phil sees productivity', 'Phil reviews tool health') not technical flows"
  - "Zero technical terms in Gherkin -- no HTTP status codes, SQL, JSON, or API paths in scenario language"
  - "Property-shaped scenarios tagged for delta accumulation invariant and model normalization roundtrip"
  - "3 walking skeletons cover the three primary user journeys: productivity review, diagnostic investigation, session identification"

issues_identified:
  happy_path_bias:
    - status: "PASS"
      detail: "22 error/edge scenarios out of 47 total = 46.8%"

  gwt_format:
    - status: "PASS"
      detail: "All scenarios follow Given-When-Then with single When action. No multi-When violations found."

  business_language:
    - status: "PASS"
      detail: "Verified zero technical terms in scenario text. Uses 'metric arrives', 'views card', 'shows rate' -- not 'POST /v1/metrics', 'HTTP 200', 'SQLite upsert'."

  coverage_gaps:
    - status: "PASS"
      detail: "All 8 user stories mapped to scenarios. Every acceptance criterion has at least one corresponding test."

  walking_skeleton_centricity:
    - status: "PASS"
      detail: "WS-1 title: 'Phil sees session productivity from ingested metric data' -- user goal. WS-2: 'Phil reviews tool execution and API health' -- diagnostic goal. WS-3: 'Phil identifies a session by IDE badge' -- identification goal. All pass stakeholder litmus test."

  priority_validation:
    - status: "PASS"
      detail: "Implementation sequence follows roadmap dependency order and JTBD opportunity scores. Model normalization first (dependency), then ingestion, then event cards, then metric cards."

approval_status: "approved"
```

---

## Mandate Compliance Evidence

### CM-A: Hexagonal Boundary Enforcement

All test files import through driving ports only:

| Test File | Driving Port(s) |
|-----------|-----------------|
| metrics-ingestion.test.ts | OTLP metrics parser (pure), MetricStore accumulator |
| model-normalization.test.ts | Model name normalizer (pure function) |
| tool-usage-card.test.ts | toolUsageAggregator (pure domain) |
| api-health-card.test.ts | apiHealthAggregator (pure domain) |
| session-enrichment.test.ts | session enricher (pure), badge mapper (pure) |
| active-time-productivity.test.ts | activeTimeFormatter, productivityFormatter (pure) |
| prompt-activity-card.test.ts | promptActivityAggregator (pure domain) |
| permissions-card.test.ts | permissionsAggregator (pure domain) |
| session-dashboard-skeleton.test.ts | Card aggregators (pure), IPC query layer |

No internal components imported: no direct SQLite access, no axum handler tests, no internal parser tests. All internal components exercised indirectly through driving ports.

### CM-B: Business Language Purity

Grep for technical terms across all test files:

- "HTTP" / "POST" / "GET": 0 occurrences in scenario text
- "SQL" / "SQLite" / "database" / "table": 0 occurrences
- "JSON" / "payload" (in GWT text): 0 occurrences (used only in file-level doc comments)
- "200" / "400" / "500" (as status codes in GWT): 0 occurrences in scenario comments
- "axum" / "handler" / "router": 0 occurrences
- Status code 429/500 used only in business context: "status 429" as API error type, not HTTP response

Business terms used: "session", "metric", "card", "badge", "Phil views", "error rate", "success rate", "accumulated", "normalized", "breakdown".

### CM-C: Walking Skeleton and Focused Scenario Counts

| Category | Count |
|----------|-------|
| Walking skeletons | 3 |
| Focused scenarios | 44 |
| Total | 47 |
| Ratio (focused/skeleton) | 14.7:1 |

Within recommended range (2-5 skeletons, 15-20+ focused per feature).

---

## Story-to-Scenario Traceability

| Story | Scenarios | Coverage |
|-------|-----------|----------|
| US-001 Metrics Ingestion | 8 (4 happy, 4 error) | All 6 AC covered |
| US-002 Tool Usage | 7 (3 happy, 4 error) | All 5 AC covered |
| US-003 API Health | 7 (3 happy, 4 error) | All 5 AC covered |
| US-004 Session Enrichment | 6 (3 happy, 3 error) | All 5 AC covered |
| US-005 Active Time + Productivity | 6 (3 happy, 3 error) | All 6 AC covered |
| US-006 Prompt Activity | 5 (2 happy, 3 error) | All 4 AC covered |
| US-007 Permissions | 5 (2 happy, 3 error) | All 5 AC covered |
| US-008 Model Normalization | 3 (2 happy, 1 property) | All 5 AC covered |

---

## Test File Inventory

```
tests/acceptance/otel-rich-dashboard/
  metrics-ingestion.test.ts          (8 scenarios, US-001)
  model-normalization.test.ts        (3 scenarios, US-008)
  tool-usage-card.test.ts            (7 scenarios, US-002)
  api-health-card.test.ts            (7 scenarios, US-003)
  session-enrichment.test.ts         (6 scenarios, US-004)
  active-time-productivity.test.ts   (6 scenarios, US-005 + WS-1)
  prompt-activity-card.test.ts       (5 scenarios, US-006)
  permissions-card.test.ts           (5 scenarios, US-007)
  session-dashboard-skeleton.test.ts (2 scenarios, WS-2 + WS-3)
```

All scenarios use `it.skip` except the first walking skeleton (to be enabled by the software-crafter when implementation begins).

---

## Handoff to Software-Crafter

### Implementation Sequence (one-at-a-time)

1. **model-normalization.test.ts** -- Enable first `it.skip`. Pure function, no dependencies.
2. **metrics-ingestion.test.ts** -- Enable walking skeleton. Requires MetricStore port + parser.
3. **active-time-productivity.test.ts** -- Enable WS-1. Requires ingestion + formatters.
4. **tool-usage-card.test.ts** -- Enable scenarios sequentially. Reads existing events.
5. **api-health-card.test.ts** -- Enable scenarios. Reads existing events.
6. **session-dashboard-skeleton.test.ts** -- Enable WS-2 when cards 4+5 pass.
7. **prompt-activity-card.test.ts** -- Enable scenarios. Reads existing events.
8. **permissions-card.test.ts** -- Enable scenarios. Reads existing events.
9. **session-enrichment.test.ts** -- Enable scenarios. Metadata extraction.
10. **session-dashboard-skeleton.test.ts** -- Enable WS-3 when enrichment passes.

### Property-Based Test Notes

Two scenarios tagged `@property` require property-based test implementation:
- **US-001**: "Accumulated metric values are never negative" -- generate random delta sequences, verify invariant
- **US-008**: "Normalized model names from metrics match event model names" -- generate model names with various bracket suffixes, verify stripping produces valid event names

### Paradigm Note

This project follows functional programming. All domain modules (aggregators, formatters, normalizer) are pure functions. The software-crafter should implement using the `@nw-functional-software-crafter` as specified in CLAUDE.md.
