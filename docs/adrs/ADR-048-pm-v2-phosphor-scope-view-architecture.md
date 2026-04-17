# ADR-048: Performance Monitor v2 Phosphor Scope View Architecture

## Status

Accepted — 2026-04-17

## Context

The v1 Performance Monitor (ADR-007, ADR-028) used a Task-Manager-style master/detail layout: a 180px left sidebar with four co-equal category sparklines (tokens, cost, agents, latency) and a right detail pane containing an aggregate chart, per-session graph grid, stats grid, and session table. Internal navigation between an aggregate overview and a session-detail view was managed by a discriminated-union `ViewMode` inside `PerformanceMonitorView.tsx` (ADR-028). Hover tooltips followed the pure-hit-test + React-DOM-tooltip split established in ADR-010.

Discovery (`docs/discovery/performance-monitor-jobs.md`) subsequently identified **ambient aliveness** as the anchor job — the user glances peripherally at the PM to confirm their concurrent Claude Code sessions are still alive and doing work, with an order-of-magnitude more triggers than any other PM job. The plan-of-record (`docs/feature/norbert-performance-monitor/design/v2-phosphor-decisions.md`) locks this in and mandates a phosphor-oscilloscope aesthetic: per-session color traces overlaid on a single canvas, afterglow decay for recent history, event-pulse flares for hook activity, and a user-toggleable Y-axis metric (Events/s, Tokens/s, Tool-calls/s). Hover reveals a minimal `session-name · value unit · time-ago` tooltip. Drill-down is explicitly delegated to adjacent views (Session Status).

The v2 DESIGN wave output (`docs/feature/norbert-performance-monitor/design/v2-phosphor-architecture.md`, §2–§4) resolves the component-boundary question: the new view set is a single registered React shell plus four children, backed by a new `domain/phosphor/*` pure module set. The v1 master/detail shell, sidebar, chart component, detail pane, stats grid, session table, and tooltip component are all replaced — no incremental migration, no feature flag (per wave decision D5).

**Quality attribute drivers (in priority order):**

1. Performance efficiency — 60fps canvas render on a Tauri webview without blocking hook ingestion or thrashing the React tree.
2. Maintainability — functional paradigm (ADR-004), pure derivation, effects confined to canvas + store boundaries.
3. Testability — pure modules unit-testable in isolation; seam-based acceptance tests at the canvas host boundary (no pixel diffing).
4. Reliability — honest signal (no sub-interval interpolation, no zero-fill between arrivals); accurate presence of motion even when data is quiet.

**Constraints:**

- Tauri 2.0 + Rust backend + React/TS frontend + SQLite + Vitest (unchanged by v2).
- Functional paradigm authoritative (ADR-004).
- PM is a single registered view within the `norbert-usage` plugin; plugin views cannot register sub-routes.
- Existing `hookProcessor` + OTel ingest pipeline (ADR-030…ADR-038, ADR-044) remains unchanged upstream of the PM.
- Registered view id `PERFORMANCE_MONITOR_VIEW_ID = "performance-monitor"` is preserved; only the rendered component changes.

## Decision

Replace the v1 PM view set with a single React view **`PhosphorScopeView`**, composed of five components under `views/phosphor/` and backed by a new pure module set under `domain/phosphor/`. Remove internal navigation, the sidebar, and the detail pane entirely.

### Component set (under `views/phosphor/`)

1. **`PhosphorScopeView.tsx`** — registered view container. Owns metric-toggle state (`Events/s | Tokens/s | Tool-calls/s`). Subscribes to `multiSessionStore` for session lifecycle. Renders `PhosphorControls`, `PhosphorCanvasHost`, `PhosphorHoverTooltip`, and `PhosphorLegend`. Holds no hot-path state.
2. **`PhosphorControls.tsx`** — segmented control for metric selection. No other controls ship in v2 (prototype's Pause/Reseed are dev-only, omitted from production).
3. **`PhosphorCanvasHost.tsx`** — the **sole effect component** on the hot path. Owns two `useRef`s: the primary `<canvas>` element and an offscreen persistence-buffer canvas for phosphor afterglow. Runs a `requestAnimationFrame` loop while mounted; pauses on `visibilitychange`. Attaches pointer events (`mousemove`, `mouseleave`) to the canvas wrapper. Reads per-frame store snapshots and passes them to pure modules. Owns no React state on the hot path; hover selection is lifted to a single `useState<HoverSelection | null>` whose only consumer is the tooltip.
4. **`PhosphorHoverTooltip.tsx`** — minimal React DOM tooltip fed `HoverSelection`. DOM (not canvas) so it can escape canvas bounds, flip at edges, and remain accessible.
5. **`PhosphorLegend.tsx`** — color swatch + session name + latest value per active session.

### Pure domain modules (under `domain/phosphor/`)

- `rateDerivation.ts` — Events/s, Tokens/s, Tool-calls/s derivation from `SessionMetrics` deltas.
- `ewma.ts` — EWMA + target smoothing over 5s ticks.
- `pulseTiming.ts` — pulse spawn/cutoff bookkeeping, decay computation.
- `scopeProjection.ts` — `sampleAt`, `timeToX`, Y-normalization (ports prototype logic).
- `scopeHitTest.ts` — `(mouseX, mouseY, frameSnapshot) -> HoverSelection | null` with distance-snap semantics from the prototype.
- `phosphorMetricConfig.ts` — pure data: metric id → { name, unit, yMax, caption }, color palette.

All domain modules import no IO. Effects are confined to `PhosphorCanvasHost` (canvas, rAF, pointer events), `multiSessionStore` (subscriptions, ring buffers, pulse log), and `hookProcessor` (event dispatch). This matches wave decision D4.

### Render architecture (summary; full detail in `v2-phosphor-architecture.md` §4, Q3)

- Canvas + offscreen persistence buffer, both in refs inside `PhosphorCanvasHost`.
- `ResizeObserver` + DPR scaling (pattern proven by `OscilloscopeView.tsx`).
- rAF loop runs while host is mounted; pauses when document hidden (aliveness job is served only when window is visible; the 5s rate pipeline keeps ticking upstream).
- **Persistence-buffer invariant:** the buffer is invalidated and recreated via a single `ensurePersistenceBuffer(w, h, metric, dpr)` helper when *any* of `{canvas width, canvas height, selected metric, DPR}` changes. On metric toggle the host discards and recreates the buffer on the next frame (honest "snap"; crossfade across incompatible Y-scales is rejected — see Alternatives).

### Hover architecture (amends ADR-010)

The pure-hit-test + React-DOM-tooltip split established in ADR-010 is retained. The implementing modules change: `chartRenderer.ts`'s hit-test is replaced by `domain/phosphor/scopeHitTest.ts`, and `PMTooltip.tsx` is replaced by `PhosphorHoverTooltip.tsx`. Distance-snap semantics from the prototype (nearest trace within a pixel radius, prefer live over faded) are added.

### Replaced v1 components (deleted as part of the v2 PR)

- `views/PerformanceMonitorView.tsx`
- `views/PMSidebar.tsx`
- `views/PMChart.tsx`
- `views/PMDetailPane.tsx`
- `views/PMStatsGrid.tsx`
- `views/PMSessionTable.tsx`
- `views/PMTooltip.tsx`

No feature flag; hard replace in a single PR (wave decision D5). The registered view id is preserved so plugin-host view routing is unchanged.

## Alternatives Considered

### Alternative 1: Keep v1 sidebar, swap only the chart for a phosphor canvas

- **What:** Retain the 180px sidebar with per-category sparklines and the master/detail shell (ADR-007, ADR-028). Replace only the detail pane's aggregate chart with a phosphor canvas.
- **Tradeoff:** Minimizes code churn. Preserves the per-category overview for users who conceptualize PM as a category browser.
- **Why rejected:** The sidebar is a solution to a different problem — multi-category overview across sessions. v2's anchor job is *ambient aliveness* (a peripheral, pre-attentive glance). The sidebar dilutes the signal by fragmenting attention across four categories and steals horizontal space from the phosphor canvas where the signal lives. Discovery's job-stack analysis makes this a clean rejection, not a tradeoff.

### Alternative 2: Render phosphor as a new tab or mode inside the v1 master/detail shell

- **What:** Add a fifth sidebar item ("Live") or a mode toggle that swaps the detail pane to the phosphor canvas while preserving the existing four-category structure.
- **Tradeoff:** Enables A/B comparison during rollout. Theoretically allows incremental migration.
- **Why rejected:** Contradicts plan-of-record decision D5 (clean replace, no feature flag, single PR). Also preserves the discriminated-union `ViewMode` from ADR-028, which the v2 design explicitly removes. Keeping two view architectures in parallel doubles the maintenance surface for a solo-developer project and defers — never resolves — the decision to commit to the phosphor aesthetic as the PM's anchor.

### Alternative 3: Render phosphor as small multiples (per-session mini-scopes in a grid)

- **What:** Instead of overlaid color traces on a single canvas, render one small phosphor canvas per session in a responsive grid.
- **Tradeoff:** Eliminates occlusion when many sessions are active. Each session gets its own unambiguous Y-axis.
- **Why rejected:** The prototype (`docs/design/performance-monitor-phosphor-prototype.html`) validated overlaid traces as the mechanism that produces *instant* aliveness — the eye reads one signal-rich canvas faster than N parallel canvases. Small multiples regress toward the v1 category-grid mental model (attention fragmented across cells) and defeat the anchor job. Occlusion is addressed instead by per-session color hue separation and hover-for-details.

### Alternative 4: Keep discriminated-union internal navigation (ADR-028) for future drill-down

- **What:** Retain `ViewMode = { tag: 'aggregate' } | { tag: 'session-detail', sessionId }` in `PhosphorScopeView`, so a future session-detail panel can be introduced without re-architecting the shell.
- **Tradeoff:** Keeps the door open for in-place drill-down.
- **Why rejected:** YAGNI under the anchor-job framing, and drill-down is explicitly delegated to the Session Status view per plan-of-record. Retaining the mechanism encourages incremental feature creep back toward v1's information density. If drill-down in-place is ever needed, reintroducing the union is a one-afternoon change.

## Consequences

- **Positive** — One view, one canvas, minimal component tree. Easier to reason about and mutation-test. Collapses v1's seven PM components into v2's five, with the domain logic in pure modules that test without React.
- **Positive** — The anchor job (ambient aliveness) is directly addressed by the architecture shape; the component tree cannot drift back toward category-grid thinking without deliberate rework.
- **Positive** — Effects are quarantined to one component (`PhosphorCanvasHost`), `multiSessionStore`, and `hookProcessor`. The rest of the PM is pure functions. Aligns with functional paradigm (ADR-004) and wave decision D4.
- **Positive** — Registered view id preserved; plugin-host routing, toolbar entry, and window-slot decisions are unchanged.
- **Positive** — Hover architecture principle from ADR-010 carries forward; only the implementing modules change.
- **Negative** — No in-place drill-down in the PM. Users needing a session-scoped numerical breakdown switch to the Session Status view. Accepted tradeoff per plan-of-record; discovery showed drill-down is a low-frequency job compared to aliveness.
- **Negative** — All v1 PM sub-view code is deleted in the v2 PR. There is no feature flag or gradual rollout; if the new view regresses in unanticipated ways, rollback is a full PR revert, not a flag flip. Accepted under solo-developer context and the clean-replace decision.
- **Negative** — The persistence-buffer discard-on-metric-toggle produces a one-frame "snap." Users may perceive this as abrupt. Accepted: the honest alternative (crossfade across incompatible Y-scales) is actively misleading, and the snap matches the prototype's established behavior.
- **Negative** — Adds a new `views/phosphor/` subfolder and a new `domain/phosphor/` subfolder, increasing directory depth. Mitigated by the clean collapse (seven v1 files deleted for five v2 files added).

## Supersedes / Amends

- **Supersedes ADR-007** (`ADR-007-pm-v2-sidebar-detail-layout.md`) — the master/detail dual-pane layout with left sidebar is removed. v2 has a single canvas with a segmented metric control; there is no sidebar and no detail pane.
- **Supersedes ADR-028** (`ADR-028-pm-view-architecture.md`) — the internal-navigation discriminated union (`{ tag: 'aggregate' } | { tag: 'session-detail', sessionId }`) is removed. v2 has a single view mode; drill-down is delegated to the Session Status view.
- **Amends ADR-010** (`ADR-010-canvas-hover-tooltip-architecture.md`) — the core principle (pure hit-test + React DOM tooltip) is retained. The implementing modules change: `chartRenderer.ts` hit-test is replaced by `domain/phosphor/scopeHitTest.ts`, and `PMTooltip.tsx` is replaced by `views/phosphor/PhosphorHoverTooltip.tsx`. Distance-snap semantics are added.

Related dispositions (captured in `v2-adr-delta.md`, authored separately): ADR-029 (canvas rendering) is upheld and its status flips from Proposed to Accepted; ADR-008, ADR-009, ADR-026, and ADR-027 are addressed by companion ADRs ADR-049 and ADR-050.
