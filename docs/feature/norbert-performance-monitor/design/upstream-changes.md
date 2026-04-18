# Performance Monitor v2 — Upstream Changes Note

**Wave:** DESIGN (propose mode)
**Date:** 2026-04-17
**Audience:** product-owner record; business-analyst revisit during the next DISCUSS pass.

The v2 phosphor redesign supersedes or de-scopes several v1 user stories (`docs/feature/norbert-performance-monitor/discuss/user-stories.md`). This note documents the changes with rationale so nothing is lost to silent supersession.

---

## User Story Disposition Table

| ID | Title | v2 Disposition | Rationale |
|---|---|---|---|
| **US-PM-001** | Performance Monitor View Registration | **KEEP, amend content** | The registration and view-slot still apply. Update the story's "grid layout" content to "phosphor scope layout" and the acceptance criteria to match the new view (single canvas + metric toggle + legend + minimal tooltip, not 2x2 grid). |
| **US-PM-002** | Multi-Session Aggregate Metrics | **SUPERSEDE** | The plan-of-record found summing rates across sessions to be mathematically meaningless for most metrics. v2 shows per-session traces overlaid; there is no aggregate row. The "aggregate always equals sum of parts" AC is moot. |
| **US-PM-003** | Session Drill-Down Navigation | **OUT OF SCOPE (delegated)** | v2 PM is a peripheral-awareness view. Drill-down into "why is *this* session slow?" is delegated to the Session Status view per plan-of-record delegation map. The PM's hover tooltip gives only `session-name · value · age`; anything deeper is out of scope. |
| **US-PM-004** | Configurable Time Window | **SUPERSEDE** | v2 fixes the window at 60 seconds (ADR-050). Historical-trend analysis across minutes-to-hours is delegated to future history views, not the ambient-aliveness PM. |
| **US-PM-005** | Context Window Pressure Monitoring | **OUT OF SCOPE (delegated)** | Per-session context pressure is delegated to per-session indicators and the Gauge Cluster, per plan-of-record delegation map. The PM never showed context in a way that composed across sessions cleanly (ADR-009 `aggregateApplicable: false` was an admission of this). |
| **US-PM-006** | Cost Rate Trending | **DE-SCOPED into the metric toggle — OPTIONAL re-add** | Cost is not one of the three chosen v2 metrics (events / tokens / toolcalls). The plan-of-record picked events/tokens/toolcalls specifically because they answer the aliveness question; cost is a billing/accounting metric served by the Cost Ticker. **If** Phil later wants `cost/min` as a fourth toggle option, ADR-048's config (`phosphorMetricConfig`) is designed to accept a fourth entry without architectural change. For v2 ship: out of scope, served by Cost Ticker. |
| **US-PM-007** | Oscilloscope Backward Compatibility | **KEEP** | The "coexist with oscilloscope view" constraint still applies: v2 does not touch `OscilloscopeView`. The acceptance criteria ("both views operational, shared data pipeline, mode switching instant") remain valid — modulo the "PM token rate chart reuses oscilloscope rendering functions" clause, which becomes false (v2 phosphor uses its own `scopeProjection.ts`, not `prepareWaveformPoints`). Amend that one clause; keep the rest. |

---

## Story-Level Amendments Recommended

These are the concrete textual changes business-analyst should make if/when the stories are revisited.

**US-PM-001** — revise "Solution" and "UAT Scenarios":

- Solution: "...registers a new 'Performance Monitor' view that displays an overlaid phosphor-oscilloscope scope of per-session rate traces with event-pulse flares. The Y-axis metric is toggleable between Events/s, Tokens/s, and Tool-calls/s."
- Domain Example 1: "...the view renders a single canvas with N color traces (one per active session), each smoothed and scrolling right-to-left over 60 seconds; event pulses flare as bright dots on each trace at hook-event arrivals; a metric segmented control above the canvas toggles the Y-axis."
- Empty state (Domain Example 3): unchanged in spirit; replace "grid" language with "scope" language.

**US-PM-007** — strike this AC item:

- "Token rate waveform in PM reuses oscilloscope rendering functions" — now false. Replace with: "PM phosphor rendering is implemented independently in `domain/phosphor/scopeProjection.ts`; the oscilloscope's `oscilloscope.ts` remains untouched."

---

## Contradiction Table (for the product-owner record)

The DISCUSS wave handoff to DESIGN noted several contradictions between v1 stories and the v2 plan-of-record. These are the explicit resolutions:

| Contradiction | v1 AC | v2 plan-of-record | Resolution |
|---|---|---|---|
| Aggregation | "Total tokens/s = sum across sessions" | "Summing rates across sessions is mathematically meaningless for most metrics." | v2 does not aggregate. US-PM-002 superseded. |
| Time-window selector | "1m/5m/15m/Session selector" | "60s window, fixed" (implicit in prototype) | v2 fixes at 60s. US-PM-004 superseded; ADR-050 records. |
| Four categories | "Tokens/s, Cost, Agents, Context/Latency" | "Events/s, Tokens/s, Tool-calls/s (toggle)" | v2 replaces the category model. ADR-049 records. |
| Drill-down | "Click session row -> session detail with agent breakdown" | "Per-session investigation lives in Session Status" | v2 delegates. US-PM-003 out of scope. |
| Context pressure | "70%/90% urgency thresholds, time-to-compaction" | "Per-session context pressure lives in per-session indicators" | v2 delegates. US-PM-005 out of scope. |
| Cost rate chart | "Cost/min as a metric chart in PM" | "Metric toggle = events/tokens/toolcalls; cost in Cost Ticker" | v2 de-scopes; designed to accept cost as a future fourth toggle. |

---

## Discovery / Research Traceability

- Anchor job and anti-jobs: `docs/discovery/performance-monitor-jobs.md`
- Live-signal-display research + anti-patterns: `docs/research/performance-monitor-live-signal-patterns.md`
- OTel telemetry reality: `docs/research/claude-code-otel-telemetry-actual-emissions.md`
- Product decisions: `docs/feature/norbert-performance-monitor/design/v2-phosphor-decisions.md`

All supersessions trace back to one of: (a) the anchor-job reframing, (b) the research's "honest smoothing" and aggregation findings, (c) the plan-of-record's explicit delegation map.
