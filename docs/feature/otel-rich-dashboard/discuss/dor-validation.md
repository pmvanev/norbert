# Definition of Ready Validation: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Validator**: Luna (product-owner)

---

## US-001: Metrics Ingestion Pipeline

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Claude Code sends metric data via POST /v1/metrics every 60 seconds, but Norbert returns 404" -- specific, domain language |
| User/persona identified | PASS | Phil Vargas, solo developer, daily Claude Code user, wants zero data loss |
| 3+ domain examples | PASS | 3 examples: cost metric, multi-type token metric, missing session.id |
| UAT scenarios (3-7) | PASS | 5 scenarios: cost ingestion, multi-point token, delta accumulation, malformed payload, missing session.id |
| AC derived from UAT | PASS | 6 AC items mapping to scenarios |
| Right-sized | PASS | ~2-3 days: new HTTP handler + parser + storage + accumulation logic |
| Technical notes | PASS | Reuse of predecessor helpers, delta temporality, model normalization, export interval |
| Dependencies tracked | PASS | claude-otel-integration (completed), schema extension noted as design decision |

### DoR Status: PASSED

---

## US-002: Tool Usage Dashboard Card

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "tool_result events are ingested and persisted but there is no UI to visualize them" |
| User/persona identified | PASS | Phil Vargas reviewing sessions, wants to understand tool patterns and bottlenecks |
| 3+ domain examples | PASS | 3 examples: mixed tool session, failed tool investigation, zero tool calls |
| UAT scenarios (3-7) | PASS | 4 scenarios: summary stats, per-tool breakdown, failed call detail, zero calls |
| AC derived from UAT | PASS | 5 AC items covering all scenarios |
| Right-sized | PASS | ~2 days: frontend component + aggregation logic from existing event data |
| Technical notes | PASS | Data source identified, aggregation strategy, sort order, available fields listed |
| Dependencies tracked | PASS | claude-otel-integration (completed) -- data already available |

### DoR Status: PASSED

---

## US-003: API Health Dashboard Card

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "no way to verify API issues because api_error events are persisted without any UI" |
| User/persona identified | PASS | Phil diagnosing slow sessions, wants to distinguish thinking from rate limiting |
| 3+ domain examples | PASS | 3 examples: single rate limit, healthy session, repeated rate limits |
| UAT scenarios (3-7) | PASS | 4 scenarios: error rate with breakdown, zero errors, retry patterns, multiple error types |
| AC derived from UAT | PASS | 5 AC items covering all scenarios |
| Right-sized | PASS | ~1-2 days: frontend component + computation from existing event data |
| Technical notes | PASS | Data source, denominator definition, known error types, available fields |
| Dependencies tracked | PASS | claude-otel-integration (completed) -- data already available |

### DoR Status: PASSED

---

## US-004: Session Metadata Enrichment

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "sessions as timestamp + event count + cost, making them indistinguishable" |
| User/persona identified | PASS | Phil browsing sessions across multiple IDEs, wants instant visual identification |
| 3+ domain examples | PASS | 3 examples: VS Code identified, mixed IDE list, missing terminal type |
| UAT scenarios (3-7) | PASS | 4 scenarios: IDE badge, version/platform, graceful degradation, multiple IDEs |
| AC derived from UAT | PASS | 5 AC items covering display and degradation |
| Right-sized | PASS | ~1-2 days: attribute extraction + session list UI update |
| Technical notes | PASS | Attribute locations (standard vs resource), known values, storage strategy |
| Dependencies tracked | PASS | claude-otel-integration (completed); schema extension noted |

### DoR Status: PASSED

---

## US-005: Active Time and Productivity Cards

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "cannot see what session produced -- cost feels like loss rather than investment" |
| User/persona identified | PASS | Phil reviewing session outcomes, wants tangible output alongside cost |
| 3+ domain examples | PASS | 3 examples: productive session, refactoring session, no metrics available |
| UAT scenarios (3-7) | PASS | 4 scenarios: active time split, lines changed, git activity, empty state |
| AC derived from UAT | PASS | 6 AC items covering all metrics and empty state |
| Right-sized | PASS | ~2 days: 3 card components + metric accumulation display |
| Technical notes | PASS | Data sources enumerated, delta temporality noted, dependency on US-001 |
| Dependencies tracked | PASS | US-001 (metrics ingestion) explicitly listed as prerequisite |

### DoR Status: PASSED

---

## US-006: Prompt Activity Dashboard Card

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "user_prompt events are persisted but invisible" |
| User/persona identified | PASS | Phil reflecting on prompting patterns |
| 3+ domain examples | PASS | 3 examples: moderate session, rapid-fire session, single prompt |
| UAT scenarios (3-7) | PASS | 3 scenarios: statistics, rate calculation, zero prompts |
| AC derived from UAT | PASS | 4 AC items covering all scenarios |
| Right-sized | PASS | ~1 day: simple metric card from existing event data |
| Technical notes | PASS | Data source, rate calculation method, prompt content availability |
| Dependencies tracked | PASS | claude-otel-integration (completed) |

### DoR Status: PASSED

---

## US-007: Permissions Dashboard Card

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "cannot see accept/reject patterns or identify tools that need configuration attention" |
| User/persona identified | PASS | Phil reviewing permission patterns, wants to optimize config |
| 3+ domain examples | PASS | 3 examples: mostly auto-approved, high manual approval, all auto-approved |
| UAT scenarios (3-7) | PASS | 3 scenarios: breakdown, per-tool, zero decisions |
| AC derived from UAT | PASS | 5 AC items covering all scenarios |
| Right-sized | PASS | ~1-2 days: card + detail view combining event and metric data |
| Technical notes | PASS | Data sources (events + metrics), source values, decision values |
| Dependencies tracked | PASS | claude-otel-integration (completed), US-001 for metric data |

### DoR Status: PASSED

---

## US-008: Model Name Normalization

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "inconsistent model names -- same model appearing as two separate entries" |
| User/persona identified | PASS | Phil viewing cost/token breakdowns, expects consistent names |
| 3+ domain examples | PASS | 3 examples: cost aggregation, token breakdown, no suffix present |
| UAT scenarios (3-7) | PASS | 3 scenarios: normalization, various suffixes, no suffix passthrough |
| AC derived from UAT | PASS | 5 AC items covering normalization and aggregation |
| Right-sized | PASS | ~0.5-1 day: regex strip + application at ingestion point |
| Technical notes | PASS | Pattern specified, timing (ingestion not frontend), verified suffixes |
| Dependencies tracked | PASS | US-001 (normalization applies during metric parsing) |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Estimated Effort | MoSCoW |
|-------|-----------|-----------------|--------|
| US-001: Metrics Ingestion Pipeline | PASSED | 2-3 days | Must Have |
| US-002: Tool Usage Dashboard Card | PASSED | 2 days | Must Have |
| US-003: API Health Dashboard Card | PASSED | 1-2 days | Must Have |
| US-004: Session Metadata Enrichment | PASSED | 1-2 days | Should Have |
| US-005: Active Time and Productivity Cards | PASSED | 2 days | Should Have |
| US-006: Prompt Activity Dashboard Card | PASSED | 1 day | Could Have |
| US-007: Permissions Dashboard Card | PASSED | 1-2 days | Could Have |
| US-008: Model Name Normalization | PASSED | 0.5-1 day | Must Have |

**Total estimated effort**: 10.5-15.5 days

**Dependency order**:
1. US-001 (Metrics Ingestion) + US-008 (Model Normalization) -- infrastructure, no UI dependency
2. US-004 (Session Enrichment) -- can parallel with US-001
3. US-002 (Tool Usage) + US-003 (API Health) + US-006 (Prompt Activity) -- all use existing event data
4. US-005 (Productivity) + US-007 (Permissions) -- depend on US-001 for metric data

All 8 stories pass DoR. Ready for handoff to DESIGN wave.
