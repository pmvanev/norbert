# ADR-050: Performance Monitor v2 Single Fixed Time Window

## Status

Accepted — 2026-04-17

## Context

The v1 Performance Monitor (ADR-027) offered the user a four-way time-window selector — **1m / 5m / 15m / Session** — backed by parallel ring buffers per session with modular downsampling (1m at every sample, 5m at every 5th, 15m at every 10th) plus a SQLite-backed historical path for the Session window. The decision to keep three windows "pre-populated and instant" (ADR-027) was sound for the v1 framing, which treated the PM as a *configurable analysis tool* whose user reached for longer windows during investigation of slow or anomalous sessions.

Two subsequent forces collapse that framing:

1. **Discovery's anchor job** (`docs/discovery/performance-monitor-jobs.md`) identified **ambient aliveness** as the dominant PM use — a peripheral, pre-attentive glance to confirm that concurrent Claude Code sessions are still alive and doing work — with an order-of-magnitude more daily triggers than any other PM job. A peripheral-awareness view does not benefit from window configurability; in fact, a shifting time scale actively undermines the pre-attentive read (the user can no longer trust a same-looking glance to mean the same throughput across visits).
2. **The plan-of-record phosphor redesign** (`docs/feature/norbert-performance-monitor/design/v2-phosphor-decisions.md`, `v2-phosphor-architecture.md`) fixes the scope's time axis at 60 seconds and removes the window selector. Historical-trend analysis over minutes-to-hours is explicitly **delegated** to future history views (not part of the v2 PM scope).

Wave decision **D8** (`docs/feature/norbert-performance-monitor/design/wave-decisions.md`) records this narrowing and quantifies the consequence: combined with ADR-049's per-metric rate buffers, eliminating the multi-window buffer set is responsible for the bulk of the ~25× memory drop (v1 ~520 KB → v2 ~20 KB for 5 concurrent sessions). The user-story disposition (`docs/feature/norbert-performance-monitor/design/upstream-changes.md`) records the corresponding supersession of **US-PM-004 — Configurable Time Window**: historical-trend analysis is delegated to future history views, not the ambient-aliveness PM.

**Quality attribute drivers (in priority order):**

1. **Aliveness-job fidelity** — the time-axis mental model must be constant so a peripheral glance is instantly legible without parsing a scale indicator.
2. **Performance efficiency** — memory footprint and per-tick work drop proportionally with the number of windows retained; fewer windows means fewer buffers and fewer downsampling counters.
3. **Maintainability** — collapsing multi-window logic removes a category of edge cases (window-switch transitions, per-window trim semantics, historical-window SQL path) from the PM code path.
4. **Testability** — one window means one buffer length per (session × metric) to reason about; property tests over `domain/phosphor/*` become single-window properties instead of cross-window coherence properties.

**Constraints:**

- Functional paradigm authoritative (ADR-004). The window choice is a constant in the pure-domain layer, not a runtime-configurable value.
- Honest-signal invariants (ADR-049, wave decision D10): no sub-interval interpolation, no zero-fill between arrivals. The 60s window holds whatever samples actually arrived; quiet sessions show sparse traces, not fabricated continuity.
- The v2 PM is a single registered view (ADR-048). There is no UI surface on which a window selector could live without reintroducing the category-grid mental model the phosphor aesthetic is designed to replace.
- Upstream of the store, the OTel ingest pipeline (ADR-030…ADR-038, ADR-044) is unchanged. This ADR concerns the PM view's window of retention only.

## Decision

**Fix the Performance Monitor time window at 60 seconds.** Remove the time-window selector UI. Remove parallel multi-window buffers from `multiSessionStore`. The single 60s rolling window is the sole time scale any v2 PM consumer sees.

### Window parameters (all locked at compile time as `domain/phosphor/*` constants)

| Parameter | Value | Source |
|---|---|---|
| Rolling window length | **60 seconds** | Plan-of-record + prototype |
| Rate-tick cadence (committed samples) | **5 seconds** (~12 committed samples per session per metric) | ADR-049 derivation cadence |
| Inter-tick progressive fill | yes (worst-case ~24–36 committed entries including progressive fills) | ADR-049 |
| Pulse visual lifetime | **2.5 seconds** | Plan-of-record |
| Pulse retention (buffer) | **5 seconds** (2.5s safety margin beyond visual lifetime) | ADR-049 |

The rate-tick and pulse figures live canonically in ADR-049 (they shape the buffers); they are restated here so the ADR-050 reader sees the complete time-axis contract in one place.

### Store-shape consequences (reference; canonically described in ADR-049)

- Per-session × per-metric rate buffers hold **one** retention horizon: 60s.
- No parallel 5m / 15m / Session buffers.
- No per-window downsampling counters (ADR-027's `counter mod 5`, `counter mod 10`).
- No SQL-backed historical-window path in the PM code. Historical analysis, if ever added, is a separate view with its own store.

### View-layer consequences (reference; canonically described in ADR-048)

- No window-selector segmented control in `PhosphorControls`. The sole segmented control in v2 selects the **metric** (Events/s, Tokens/s, Tool-calls/s).
- `timeToX` in `domain/phosphor/scopeProjection.ts` treats the window length as a fixed constant, not a prop or runtime value. Unit tests hardcode the 60s window.

### File-level consequences

- `domain/multiWindowSampler.ts` is **deprecated for PM use**. If no other view in the plugin depends on it at v2 merge time, delete the file. If another view (e.g., `OscilloscopeView`) depends on it, retain the file and remove only the PM's callsites. The determination is made at the adapter-implementation step (roadmap step 02-xx) by inspecting imports.
- Any remaining `windowMs` / `windowId` parameters on PM-facing public APIs of `multiSessionStore` are removed, not defaulted. No caller passes `windowMs: 60_000` defensively; the value is simply absent from the type.

## Alternatives Considered

### Alternative 1: Keep the 1m / 5m / 15m selector, render all three choices in the phosphor aesthetic

- **What:** Preserve ADR-027's parallel ring-buffer design. Render whichever window is selected into the phosphor canvas using the same overlaid-trace aesthetic. The metric toggle and the window toggle both live in `PhosphorControls`.
- **Tradeoff:** Minimizes user-story churn — US-PM-004 stays intact and its AC can be re-read against the phosphor view. Preserves investigative use when a user wants to see "what happened in the last 15 minutes on this session."
- **Why rejected:**
  1. **Dilutes the anchor-job signal.** The phosphor aesthetic's peripheral legibility depends on a stable time axis. With the window selector in play, a 60s glance and a 15m glance show the same canvas area with different throughput scales; the user must read the window indicator every time before trusting the read. That is exactly the pre-attentive failure mode the aesthetic is designed to eliminate.
  2. **Confuses the Y-axis scale mental model.** The metric toggle already changes the Y-axis (Events/s vs Tokens/s vs Tool-calls/s). Adding a second toggle that changes the X-axis doubles the scale-parsing burden for a view whose job is instantaneous legibility.
  3. **Retains the 25× memory cost.** The parallel-buffer design is the main contributor to the v1 footprint; keeping it defeats the memory-budget benefit of v2.
  4. **Historical investigation is better served elsewhere.** Plan-of-record delegates multi-minute-to-hour analysis to future history views with their own storage + query surface. Keeping a 15m slice in the PM is a half-measure that competes with (and underserves) the delegated view.

### Alternative 2: Fix the window at 5 minutes instead of 60 seconds

- **What:** Single-window design exactly as decided, but set the constant to 300 seconds. Retain the 5s rate-tick cadence; the canvas shows ~60 committed samples scrolling over 5 minutes.
- **Tradeoff:** A 5-minute view gives the user a slightly wider recent history without a selector. Still one window, still one buffer per metric — same architectural simplification as the 60s choice.
- **Why rejected:**
  1. **Prototype validation is specifically at 60s.** `docs/design/performance-monitor-phosphor-prototype.html` (the plan-of-record's visual reference) was tuned at 60s; the scroll speed, afterglow decay, and pulse lifetime are calibrated to that window. Moving to 5m slows the trace motion by 5× and the afterglow decay ratio; the "alive" quality the prototype captures depends on this calibration.
  2. **Peripheral-perception lag.** At 5 minutes, a session that goes quiet for 30 seconds still looks busy in the periphery because the trace's recent activity has not scrolled off screen. The aliveness job requires the display to react promptly to a session genuinely going quiet; 60s makes that lag ~30s worst case, 5m makes it ~150s. The shorter window is more honest.
  3. **12 samples per window is enough.** At the 5s rate-tick cadence, 60s gives ~12 committed samples — enough to express trace shape without the pre-attentive visual noise of ~60 samples smashed into the same canvas width.

### Alternative 3: Auto-scale the window based on session activity

- **What:** Compute an adaptive window per frame: if a session is busy, show the most recent 30s; if quiet, show up to 5 minutes. The canvas always "feels full" regardless of actual throughput.
- **Tradeoff:** Maximizes the visible shape of the signal. No empty-canvas state for quiet sessions.
- **Why rejected:**
  1. **Dishonest scaling.** If the window shifts under the user between glances, a same-looking canvas means different throughput at different times. The aliveness job's pre-attentive read is actively misled.
  2. **Violates the honest-signal invariant** (ADR-049, wave decision D10). Auto-scaling is a stronger variant of sub-interval interpolation: it forges visual continuity the underlying data does not guarantee.
  3. **Adds a second derivation pipeline.** The view now needs two time axes: the buffer's retention horizon and the current render's visual horizon. Pure-domain tests become combinatorial (every invariant tested across the cross-product of both horizons).
  4. **Defeats the per-session color-hue separation.** With adaptive windows per session, two sessions could be rendered at different time scales on the same canvas. Their traces are no longer comparable at a glance — the core affordance of overlaid traces collapses.

### Alternative 4: Single 60s window in the store, but expose a read-only "zoom" on the view (render any sub-window of [0s, 60s])

- **What:** Keep the store's retention at 60s (matching this ADR's memory budget) but let `PhosphorCanvasHost` render any contiguous sub-window — e.g., "last 30s" or "last 10s" — via a UI control that scales `timeToX` without changing the store.
- **Tradeoff:** Preserves the store simplification and memory budget. Offers some user-side zoom for investigation.
- **Why rejected:**
  1. **Reintroduces the scale-parsing burden** that Alternative 1 was rejected for. The user must read the zoom indicator to interpret the canvas; the aliveness job loses its pre-attentive read.
  2. **No evidence of demand.** Discovery surfaced no job that needed a <60s zoom. The JTBD stack is aliveness → spike-spotting → peer-comparison, all of which are served by a stable 60s window.
  3. **Couples the view to a time-axis control.** `scopeProjection.ts` becomes parametric over window length, adding a surface for tests and for the hot path. YAGNI: if a zoom is ever needed, adding it then is a localized change.
  4. **Creates a latent inconsistency with pulse timing.** Pulse visual lifetime (2.5s) and pulse retention (5s) are calibrated against the 60s window. A zoomed 10s view would show pulses that nominally "lived" for 25% of the visible window — a visual oddity that either masks or amplifies the pulse channel in ways not validated by the prototype.

## Consequences

- **Positive — Anchor-job fidelity.** The time axis is a constant. Every PM glance uses the same 60s scale, so two glances at different moments are directly comparable without parsing a selector.
- **Positive — Memory drop.** Combined with ADR-049's per-metric rate buffers, the 60s-single-window decision is responsible for the bulk of the v1 → v2 footprint reduction. Quantified in ADR-049: v1 ~520 KB (5 sessions × 4 categories × 3 windows × 900-sample rings) → v2 ~20 KB (5 × 3 × ~30 + pulses). The single-window decision (this ADR) eliminates the ×3 from the v1 term; ADR-049 eliminates the ×4 from categories.
- **Positive — Simpler store.** `multiSessionStore` holds one retention horizon per (session × metric). No modular downsampling counters, no per-window trim, no historical-window SQL path. The public API (see ADR-049) carries no `windowMs` parameter.
- **Positive — Simpler view.** `PhosphorControls` has exactly one segmented control (the metric toggle). No window selector, no window indicator, no window-change transition animation to design. `scopeProjection.timeToX` takes `now` and the fixed 60s constant; no parametric window length.
- **Positive — Fewer test paths.** Pure-domain property tests cover one window length. ADR-027's property ("window-switch never loses data") does not exist in v2 because there is no window switch. Acceptance tests for the PM never need to exercise the window-selector path.
- **Positive — Explicit delegation of historical analysis.** US-PM-004 (Configurable Time Window) is recorded as superseded in `upstream-changes.md`; historical-trend analysis is an explicit responsibility of future history views. The PM's job description narrows to the one the anchor-job analysis validated: ambient aliveness over the most recent minute.
- **Negative — Historical-window use case not served by this view.** A user who wants "what did this session do 10 minutes ago?" cannot answer it from the PM. Accepted: the plan-of-record delegates that to future history views, and discovery did not rank that job above the aliveness anchor.
- **Negative — Breaking change vs ADR-027.** The window-selector UI and the parallel ring-buffer design are removed. The v1 PM views that consumed them are deleted in the same PR (ADR-048); no v2 consumer is left orphaned. The oscilloscope view's own 60s fixed-window design (ADR-015) is unaffected.
- **Negative — `domain/multiWindowSampler.ts` fate is conditional.** Whether the file is deleted outright or retained (for non-PM callers) is determined at the adapter-implementation step. Acceptable: the conditionality is bounded to one file and one import scan.
- **Neutral — Window constant lives in code, not config.** No environment variable, no user setting, no developer override. If the figure is ever revisited, it is a code change (and therefore an ADR amendment), not a knob. This is the intended discipline for a peripheral-awareness view.

## Supersedes / Amends

- **Supersedes ADR-027** (`ADR-027-pm-multi-window-time-series.md`) — the parallel-ring-buffer multi-window design (1m / 5m / 15m + Session historical) and its time-window selector are removed in their entirety. v2 uses a single 60s rolling window backed by the per-metric rate buffers described in ADR-049. ADR-027's memory budget (~520 KB for 5 sessions × 3 windows × 900 samples) is eliminated in full for the PM; only the oscilloscope view's own 60s fixed-window buffer (unrelated, governed by ADR-015) remains.

Related dispositions (captured in `v2-adr-delta.md`):

- **ADR-048** (phosphor scope view architecture) defines the `PhosphorScopeView` shell that consumes this single-window contract and the `PhosphorControls` segmented control that has no window-selector entry.
- **ADR-049** (per-session rate buffers + pulse log) defines the buffer shapes whose retention horizon this ADR locks at 60s, and separately addresses ADR-008, ADR-009, and ADR-026.

User-story impact (captured in `upstream-changes.md`):

- **US-PM-004 — Configurable Time Window** is **superseded**. Historical-trend analysis across minutes-to-hours is delegated to future history views. The PM's time axis is constant.
