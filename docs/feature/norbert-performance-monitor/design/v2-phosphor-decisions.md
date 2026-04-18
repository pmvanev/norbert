# Performance Monitor v2 — Design Decisions (Phosphor Redesign)

**Status:** Plan-of-record for the Performance Monitor redesign. Inputs consolidated for the DESIGN wave.
**Date:** 2026-04-17
**Supersedes:** `performance-monitor-design-spec.md` (v1, Task-Manager-style 4-category stacked design).

---

## Why v1 is being replaced

The v1 Performance Monitor was modeled on Windows Task Manager — four live-updating metric categories (Tokens/s, Cost, Agents, Latency) aggregated across all active Claude Code sessions, with a sidebar + detail-pane drill-down.

Evidence from discovery + research (see References) found three concrete problems:

1. **Categories were picked for chart uniformity, not jobs.** Context % was swapped for Latency because percentages aren't aggregable across sessions — a UX decision driven by chart layout rather than user need.
2. **Summing rates across sessions is mathematically meaningless for most metrics.** "Aggregate tokens/s across 3 sessions" rarely answers a real question; the `aggregateApplicable: false` escape hatch for Context admits this.
3. **The design conflates two jobs** — category-first drill-down vs. session-first drill-down — and serves neither cleanly.

Additionally, Claude Code's telemetry shape has clarified since v1 was designed: authoritative `cost_usd`, `input_tokens`, `output_tokens`, `cache_*_tokens` arrive via OTel logs on a ~5s cadence, making v1's elaborate 100ms sampling + rate inference both over-engineered and mildly dishonest about liveness.

---

## Anchor Job (from discovery)

**Ambient aliveness for flow-state protection.** When concurrent Claude Code agents are running and the user has switched to other work, they want peripheral-vision confirmation that the agents are alive and churning — without context-switching to check. The *shape of motion itself is the answer*, not any specific number.

This is the highest-recurrence trigger by far: dozens of glances per hour during concurrent-agent workflows vs. a few per day for headroom decisions or re-entry orientation. Phil (product owner, representative user) confirmed this anchor against his own usage: he actively watches Norbert while sessions run to sense them ticking and churning.

Full JTBD analysis, trigger-moment map, and anti-jobs list: `docs/discovery/performance-monitor-jobs.md`.

---

## Chosen Direction

**Overlaid phosphor oscilloscope**, per-session color traces with afterglow decay. Data comes from two channels composited visually:

- **Rate envelope** — EWMA-smoothed from OTel log events (~5s cadence). Drawn as a continuous trace per session.
- **Event pulses** — instant hook events (tool calls, sub-agent spawns, lifecycle) drawn as bright flares on the trace at their arrival timestamp.

Rendering scrolls right-to-left at 60fps independent of data arrival, giving a continuous live feel. No sub-interval interpolation (would invent spikes); no zero-fill between arrivals (would create false drops). Afterglow decay provides the "cool signal display" aesthetic by design, not by fabrication.

Research basis for the technique and anti-patterns: `docs/research/performance-monitor-live-signal-patterns.md`.

---

## Resolved Decisions

| # | Decision | Detail |
|---|---|---|
| 1 | **Y-axis metric** | User-toggleable between **Events/s**, **Tokens/s**, **Tool-calls/s**. Each has its own Y-scale and units. No composite. Default: TBD after Phil lives with the prototype. |
| 2 | **Hover tooltip** | Minimal: `session-name · value unit · time-ago` (e.g., `session-3 · 47 evt/s · 1.5 s ago`). Deeper per-session drill-down is not a PM responsibility. |
| 3 | **View slot** | Keep the existing Norbert Performance Monitor view slot. No compact/docked/secondary-monitor variant in scope for v2. |
| 4 | **Replacement scope** | The phosphor design replaces the current PM view entirely. Adjacent views (Oscilloscope, Gauge Cluster, Session Status, etc.) are explicitly **out of scope** for this change. |

---

## Delegation (Jobs explicitly not owned by the PM)

| Job | Lives in |
|---|---|
| Per-session investigation ("why is *this* session slow?") | Session Status |
| Historical cost / accounting ("what did today cost me?") | Usage / Cost Ticker |
| Per-session context-window pressure | per-session indicators |
| Stall detection + alerting | `norbert-notif` plugin |
| Precise numeric reporting | any of the above — PM conveys *shape and intensity*, not exact figures |

If the user wants a number, they click through. PM's job is to answer "how does this feel right now?" without words.

---

## Open Questions for the DESIGN Wave

Architecture-level questions that nw:design needs to resolve:

1. **Data derivation pipeline.** How are Events/s, Tokens/s, and Tool-calls/s each derived from the existing hookProcessor + OTel ingest? What changes (if any) to `multiSessionStore`, `hookProcessor`, `categoryConfig`? Do we need new pure functions in `domain/`? The current TODO in `multiSessionStore.ts` about `CategorySample` semantic mismatch is probably resolved by this redesign.
2. **Component boundaries.** Replace what exactly — `PerformanceMonitorView`, `PMSidebar`, `PMChart`, `PMDetailPane`, `PMStatsGrid`, `PMTooltip`? Collapse to a single `PhosphorScopeView` with internal canvas + overlay? What's the right split for functional paradigm?
3. **Render architecture.** Canvas + persistence buffer per the prototype. Where does it live in the Electron + React tree? How does metric-toggle reset afterglow cleanly? Does the persistence buffer belong in component state or a ref?
4. **Functional-paradigm structure.** Per `CLAUDE.md`: pure functions for rate derivation, EWMA, pulse-timing; effects confined to canvas rendering. How does this map onto the existing plugin structure, and what existing pure modules (cross-session aggregator, urgency thresholds, etc.) stay, change, or get deprecated?
5. **Migration / cutover strategy.** Hard replace vs. toggle-behind-flag vs. deprecate-with-notice? Given Phil is the sole user right now, a clean cut is likely fine — confirm during DESIGN.
6. **Adjacent views after cutover.** The existing `oscilloscope` view registration (preserved in v1 for backward compatibility) and `gauge-cluster` — are they still needed once phosphor PM ships? Likely candidates for removal, but out of scope for v2 per decision #4. Confirm *handling* rather than scope expansion.
7. **Test strategy.** Per `CLAUDE.md` mutation-testing is per-feature. What does a meaningful test suite look like for a canvas-rendered live signal? What's the Outside-In TDD seam?

---

## Visual References

- **Comparison mockup** (streamgraph vs. horizon vs. phosphor): `docs/design/performance-monitor-aesthetics.html`
- **Focused phosphor prototype** (metric toggle, hover tooltip, hybrid compositing): `docs/design/performance-monitor-phosphor-prototype.html`

The prototype is the authoritative visual spec for v2 — architecture should produce code that makes the live app behave and feel like that file.

---

## Input Documents

- `docs/discovery/performance-monitor-jobs.md` — JTBD, anchor job, trigger moments, anti-jobs
- `docs/research/performance-monitor-live-signal-patterns.md` — visualization patterns, honest smoothing strategies, cross-session aggregation options
- `docs/research/claude-code-otel-telemetry-actual-emissions.md` — authoritative Claude Code telemetry data
- `docs/feature/norbert-performance-monitor/design/performance-monitor-design-spec.md` — v1 spec (superseded)
- Project memory: `project_performance_monitor_redesign.md`

---

## Constraints Carried Forward

- **Functional programming paradigm** (per `CLAUDE.md`) — implementation via nw-functional-software-crafter.
- **Per-feature mutation testing** (per `CLAUDE.md`).
- **Phil's UI guide** — glassmorphism, premium feel, micro-animations, vibrant palettes; Unicode symbols over emoji; amber for notification badges; views have sec-hdr title areas.
- **Live-signal aesthetic is non-negotiable** (per project memory `feedback_performance_monitor_live_graph.md`) — do not devolve toward static dashboards / event logs / tables as the primary view.
