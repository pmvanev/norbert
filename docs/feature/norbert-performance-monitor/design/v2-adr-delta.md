# Performance Monitor v2 — ADR Delta Map

**Wave:** DESIGN (propose mode)
**Date:** 2026-04-17
**Companion:** `v2-phosphor-architecture.md`

Maps every existing PM-related ADR in `docs/adrs/` to one of **KEEP** (still authoritative), **AMEND** (still authoritative but updated for v2), **SUPERSEDE** (replaced by a new v2 ADR).

**Numbering note:** The repo has two ADR-007, ADR-008, ADR-009, and ADR-010 (one at the repo-foundation level, one at the "v1 PM redesign era" level). The table below disambiguates by filename. New v2 ADRs take the next-available numbers in the canonical 0XX sequence: **ADR-048**, **ADR-049**, **ADR-050**.

---

## Delta Table

| File | Title (short) | Disposition | Justification |
|---|---|---|---|
| `ADR-007-pm-v2-sidebar-detail-layout.md` | PM v2 sidebar + detail layout | **SUPERSEDE** by **ADR-048** | v2 (phosphor) has no sidebar or detail pane. Single canvas + metric toggle replaces the Task-Manager-style dual-pane. |
| `ADR-008-per-session-category-time-series-buffers.md` | Per-session, per-category buffers | **SUPERSEDE** by **ADR-049** | v2 replaces 4-category buffers (tokens/cost/agents/latency) with 3 per-metric rate buffers (events/tokens/toolcalls) + a per-session pulse log. The `CategorySample` semantic TODO is resolved structurally. |
| `ADR-009-aggregate-applicability-by-category.md` | aggregateApplicable flag per category | **SUPERSEDE** by **ADR-049** (the same replacement) | v2 does not aggregate across sessions. The concept of "aggregate applicability" is moot: every trace is per-session and shown individually. |
| `ADR-010-canvas-hover-tooltip-architecture.md` | Canvas hover tooltip split (pure hit-test + React tooltip) | **AMEND** — the core principle holds (pure hit-test, React DOM tooltip); v2 uses new pure modules (`scopeHitTest.ts`, `PhosphorHoverTooltip.tsx`) with distance-snap semantics from the prototype. | The architectural idea is sound; the implementing modules change. The amended note lives inside ADR-048 rather than creating a standalone ADR. |
| `ADR-026-pm-multi-session-aggregation.md` | Additive multi-session store | **AMEND** | The store still exists and remains additive alongside the broadcast-session `metricsStore`. But v2 drops the *aggregate buffers* and *aggregate sums* from its responsibilities. Update status to "Accepted (amended 2026-04-17: aggregate buffers removed for v2, per ADR-049)". |
| `ADR-027-pm-multi-window-time-series.md` | Multi-window (1m/5m/15m/Session) buffers | **SUPERSEDE** by **ADR-050** | v2 has a single fixed 60s rolling window. The time-window selector is removed (US-PM-004 superseded). Memory budget reduces accordingly. |
| `ADR-028-pm-view-architecture.md` | Internal navigation (aggregate ↔ detail) via discriminated union | **SUPERSEDE** by **ADR-048** | v2 has no internal navigation. Single view, single canvas. The discriminated-union pattern is no longer needed. |
| `ADR-029-pm-canvas-rendering.md` | Replace uPlot with HTML Canvas | **KEEP** (status upgrade to **Accepted**; currently "Proposed") | v2 extends the canvas-rendering choice rather than reversing it. The phosphor design is natively a canvas technique (offscreen persistence buffer, globalCompositeOperation). This ADR is vindicated. Recommend flipping status from Proposed to Accepted as part of the v2 PR. |
| `ADR-015-usage-plugin-time-series-sampling.md` | Ring buffer + event-driven sampling (oscilloscope) | **KEEP** | Governs the existing Oscilloscope view and the underlying ring-buffer primitives (`timeSeriesSampler.ts`), both of which v2 reuses. |
| `ADR-030..ADR-038`, `ADR-044` | OTel ingest pipeline | **KEEP** | Ingest is unchanged upstream of the PM. v2 reads the same `SessionMetrics` stream. |
| `ADR-016`, `ADR-017` | Pricing model, client-side aggregation | **KEEP** | Used by Cost Ticker + SessionMetrics; unrelated to PM rendering. |

Other ADRs (config plugin, notif plugin, plugin sandboxing, distribution, etc.) are orthogonal and not listed.

---

## New ADRs (to author in DELIVER wave, proposed text sketched here)

### ADR-048 — PM v2 Phosphor Scope View Architecture

**Status:** Proposed (Accepted when DELIVER merges).

**Context:** v1 PM used a sidebar + detail-pane layout with 4 co-equal metric categories. Discovery (`docs/discovery/performance-monitor-jobs.md`) identified ambient aliveness as the anchor job with an order of magnitude more triggers than any other. The plan-of-record `v2-phosphor-decisions.md` mandates a phosphor-oscilloscope aesthetic with per-session color traces, afterglow, event pulses, and a user-toggleable Y-axis metric.

**Decision:** Single React view `PhosphorScopeView` containing a segmented-control `PhosphorControls`, a canvas-rendering `PhosphorCanvasHost` (offscreen persistence buffer + 60fps rAF loop), a React DOM `PhosphorHoverTooltip`, and a `PhosphorLegend`. Hit-testing is a pure function; the tooltip is React DOM (for edge-flipping and accessibility). Internal navigation, sidebar, and detail pane are removed. Drill-down is delegated to adjacent views (Session Status).

**Alternatives considered:**
1. *Keep sidebar, swap chart for phosphor.* Rejected: sidebar was a solution to a different problem (per-category overview across sessions). v2's job is ambient-aliveness; sidebar dilutes the signal.
2. *Render phosphor as a tab inside v1 master/detail.* Rejected: contradicts plan-of-record decision #4 (clean replace).
3. *Render phosphor + small multiples (per-session mini-scopes).* Rejected: prototype validates overlaid traces are more instantly alive than small multiples; small multiples regress to a category-like layout.

**Consequences:**
- **+** One view, one canvas, minimal component tree. Easier mutation testing.
- **+** Anchor job directly addressed.
- **−** No drill-down in-place (explicit delegation to Session Status view).
- **−** All v1 PM sub-view code deleted (acceptable per clean-replace decision).

Supersedes: ADR-007 (pm-v2-sidebar-detail-layout), ADR-028 (pm-view-architecture). Amends: ADR-010 (hover tooltip; principle retained, modules updated).

---

### ADR-049 — PM v2 Per-Session Rate Buffers and Pulse Log

**Status:** Proposed.

**Context:** v1 `multiSessionStore` held per-session, per-category time-series buffers for four categories (tokens, cost, agents, latency), plus aggregate-buffer sums across sessions. `CategorySample` stored category values in a `RateSample.tokenRate` field with a TODO admitting the semantic mismatch. v2 requires only three metrics (Events/s, Tokens/s, Tool-calls/s), does not aggregate across sessions, and adds a per-session pulse event stream for hook-driven flares.

**Decision:** Replace `CategorySample`/`CategorySampleInput` with:
- Per-session, per-metric rate buffers keyed on `MetricId = "events" | "tokens" | "toolcalls"`, each a ring buffer of timestamped rate samples (single 60s window, ~24–36 entries at 5s cadence plus inter-tick progressive fills).
- Per-session pulse log (`PulseEvent { t, strength, kind }`) with 5s retention.
Remove aggregate buffers and running aggregate sums. Public store methods shift from `appendSessionSample(categorySamples)` to `appendRateSample(sessionId, metric, value)` and `appendPulse(sessionId, pulse)`.

**Alternatives considered:**
1. *Keep existing `CategorySample` shape, add two categories.* Rejected: entrenches misnomer; keeps aggregate machinery we no longer need.
2. *Compute rates in the view each frame from raw events.* Rejected: violates functional-paradigm rule (effects at boundaries); wastes CPU at 60fps.
3. *Per-metric buffers but keep aggregate buffers for future "summed" view.* Rejected: YAGNI; the plan-of-record rules out aggregation; memory/complexity not justified by speculative future.

**Consequences:**
- **+** Resolves `CategorySample` semantic TODO structurally.
- **+** Store shape matches prototype semantics 1:1 (simpler reasoning, faster tests).
- **+** Memory drop: v1 ~520KB (5 sessions × 3 windows × 900 samples); v2 ~20KB (5 × 3 × 30) + pulse log.
- **−** v1 views still consuming category buffers must be rewired or removed; v2 deletes all of them, so this is a non-issue.
- **−** One breaking change to `multiSessionStore` public API.

Supersedes: ADR-008 (per-session-category-time-series-buffers), ADR-009 (aggregate-applicability-by-category). Amends: ADR-026 (pm-multi-session-aggregation; aggregate buffers removed).

---

### ADR-050 — PM v2 Single Fixed Time Window

**Status:** Proposed.

**Context:** v1 PM offered 1m/5m/15m/Session windows via parallel ring buffers (ADR-027). The phosphor prototype uses a single 60s rolling window, consistent with the ambient-aliveness job (peripheral glance, not historical analysis — historical analysis is delegated to Session Status / future history views).

**Decision:** Fix the PM window at 60 seconds. Remove the time-window selector UI. Remove parallel multi-window buffers from `multiSessionStore`. Deprecate `domain/multiWindowSampler.ts` (retain the file only if another view imports it; otherwise delete).

**Alternatives considered:**
1. *Keep 1m/5m/15m selector but render all three in the phosphor aesthetic.* Rejected: the metric toggle is already one dimension of user choice; adding a window toggle dilutes the ambient-glance signal and confuses the Y-axis scale mental model.
2. *Fix at 5 minutes instead of 1 minute.* Rejected: the prototype explicitly validated 60s; rate ticks every 5s give 12 samples per session in the window, which is enough to show shape without excessive lag in peripheral perception.
3. *Auto-scale window based on session activity.* Rejected: dishonest scaling (the user can no longer compare glances across time if the window shifts under them).

**Consequences:**
- **+** Significant memory drop (see ADR-049 numbers).
- **+** Simpler store, simpler view, fewer test paths.
- **−** Historical-window use case (US-PM-004, superseded) not served by this view. Delegated to future history view.

Supersedes: ADR-027 (pm-multi-window-time-series).

---

## Out-of-Scope ADRs (noted for the record)

- **Future contract tests for the OTel ingest boundary:** not a v2 PM concern; captured for the ingest roadmap.
- **Future removal of oscilloscope/gauge-cluster views:** per plan-of-record, out of scope for v2.
