# Performance Monitor — Evolution Record (v2 Phosphor Scope)

**Feature ID**: `norbert-performance-monitor`
**Iteration**: v2 (phosphor scope)
**Supersedes**: v1 sidebar + detail master-detail layout (`2026-03-19-norbert-performance-monitor-v2.md`)
**Delivered**: 2026-04-17
**Paradigm**: Functional
**Crafter**: nw-functional-software-crafter

---

## Wave Summary — the story of v2

v1 modeled the Performance Monitor on Windows Task Manager: four live-updating categories (Tokens/s, Cost, Agents, Context/Latency) aggregated across sessions, with a sidebar + detail-pane drill-down. It shipped on 2026-03-19 and was almost immediately superseded by its own success: once Phil lived with it, discovery (`docs/discovery/performance-monitor-jobs.md`) surfaced a much higher-recurrence anchor job — *ambient aliveness for flow-state protection*. Dozens of peripheral-vision glances per hour during concurrent-agent workflows, versus a few per day for headroom decisions or re-entry orientation. A dashboard of numbers answered neither, and v1 had three structural problems that research made explicit:

1. Categories were picked for chart uniformity, not jobs. (Context% was swapped for Latency because percentages don't aggregate.)
2. Summing rates across sessions is mathematically meaningless for most metrics.
3. The design conflated two jobs (category-first vs session-first drill-down) and served neither cleanly.

v2 replaces the entire view with an **overlaid phosphor oscilloscope**: one color trace per session, afterglow decay, hook-event pulses flaring on each trace, a user-toggleable Y-axis metric (Events/s, Tokens/s, Tool-calls/s), and a minimal hover tooltip (`session-name · value unit · time-ago`). Rendering scrolls right-to-left at 60fps independently of data arrival. No sub-interval interpolation. No zero-fill between OTel ticks. Motion comes from render scroll plus EWMA smoothing of arrived samples — honest, not fabricated.

The wave ran the full nWave lifecycle against a locked plan-of-record:

- **DISCUSS** — user stories and anchor-job reframing (Mar 18).
- **DESIGN** — v2 phosphor architecture; 6 pure domain modules + 5 view components; 3 new ADRs.
- **DISTILL** — 56 + 2 = 58 scenarios across 7 feature files; triple review gate (PO ✔ / SA ✔ after 1 revision / PA ✔).
- **DELIVER** — 46 step commits (walking skeleton → M1 → M2 → M3 → M4 → M5 → integration checkpoints → views → registration swap → v1 deletions + mutation gate); L1-L4 refactor; dual adversarial review; mutation gate pass at ~88% kill rate; DES integrity verified.

All delivered on `main`. Final test suite: **1720 passed / 103 skipped / 0 failed**. `lint:boundaries` clean. `tsc --noEmit` clean.

---

## Key Decisions

### DESIGN wave (D1-D10, recorded in `v2-phosphor-architecture.md` + `wave-decisions.md`)

| # | Decision |
|---|---|
| D1 | Replace v1 per-category (4) buffers with per-metric (3) rate buffers + per-session pulse log. Resolves `CategorySample` semantic TODO structurally. |
| D2 | Collapse 7 v1 PM view components into 5 phosphor components under `views/phosphor/`. |
| D3 | Canvas + offscreen persistence buffer in refs inside `PhosphorCanvasHost`; discard-and-recreate on metric toggle (no crossfade — cross-scale superposition would be misleading). |
| D4 | Pure `domain/phosphor/*` modules; effects confined to `PhosphorCanvasHost`, `multiSessionStore`, `hookProcessor`. Paradigm enforced via dependency-cruiser. |
| D5 | Hard replace in a single PR (no feature flag). Sole-user context; view ID `performance-monitor` preserved. |
| D6 | Leave oscilloscope, gauge cluster, session status, cost ticker untouched. Adjacent-views scope firewall. |
| D7 | Outside-In TDD seam: pure `buildFrame(store, metric, now)` + `scopeHitTest(mouseXY, frame)`. No pixel-diffing. Canvas smoke test omitted (`jest-canvas-mock` declined). |
| D8 | Fix time window at 60s; delete multi-window selector. Memory drops ~25×. |
| D9 | Recommend `dependency-cruiser` rule to enforce phosphor-domain purity (boundary rules without enforcement erode). |
| D10 | Deprecate `heartbeat.ts` — 60fps render provides continuous motion from data alone. Zero-fill is an anti-pattern. |

### DISTILL wave (DD1-DD9, recorded in `distill/wave-decisions.md`)

| # | Decision |
|---|---|
| DD1 | Acceptance tests drive the pure-domain seam from D7; honest-signal invariants expressed at the domain boundary without canvas/DPR coupling. |
| DD2 | Vitest with `.feature` files as spec-documentation (no Cucumber runner). One runner; stakeholder-readable Gherkin. |
| DD3 | Tests import real internal modules; no mocks for pure domain (mocking the seam would be testing theater). |
| DD4 | No canvas smoke test in DISTILL scope (follows D7 and declined `jest-canvas-mock`). |
| DD5 | One-at-a-time TDD via Vitest `describe.skip` → active `describe`; outside-in outer-loop red/green. |
| DD6 | Acceptance test path `tests/acceptance/norbert-performance-monitor-v2/`; `-v2` suffix during coexistence. |
| DD7 | Gherkin in business language only: session, trace, pulse, flare, metric, scope, hover, afterglow. |
| DD8 | **SA reviewer BLOCKER fix (rev 1):** M3-S4 (persistence-buffer reset) reframed as a frame-observable consequence through `buildFrame` alone. Identity-assertion on a view-internal handle deleted from the acceptance surface. |
| DD9 | **SA reviewer MAJOR fix (rev 1):** M3-S7 (hover clear on metric change) reframed through `buildFrame` + `scopeHitTest`. `onMetricChange` view-reducer declaration deleted from the acceptance surface. |

### New ADRs authored in DELIVER

- **ADR-048** — PM v2 phosphor scope view architecture (supersedes ADR-007, ADR-028; amends ADR-010).
- **ADR-049** — PM v2 per-session rate buffers and pulse log (supersedes ADR-008, ADR-009; amends ADR-026).
- **ADR-050** — PM v2 single fixed 60s time window (supersedes ADR-027).

ADR-029 (Replace uPlot with HTML Canvas) flipped from "Proposed" to vindicated; v2 doubled down on canvas rendering with offscreen persistence buffer + `globalCompositeOperation`. ADR-030..ADR-038 and ADR-044 (OTel ingest pipeline) unchanged — v2 is a view-and-adapter delta, not a system-level reshape.

---

## What Was Built

### Pure domain modules — `src/plugins/norbert-usage/domain/phosphor/`

| Module | Purpose |
|---|---|
| `phosphorMetricConfig.ts` | Metric id → name/unit/yMax/caption; 5-entry session color palette. Pure data. |
| `rateDerivation.ts` | `deriveEventsRate`, `deriveTokensRate`, `deriveToolCallsRate` — windowed counters and delta-over-duration. |
| `ewma.ts` | `ewmaStep(current, target, alpha)` — single-step EWMA (target-attraction form for floating-point idempotence). |
| `pulseTiming.ts` | `decayFactor(ageMs, lifetimeMs)`, `prunePulses(log, now, cutoffMs)` — pulse lifetime bookkeeping. |
| `scopeProjection.ts` | `buildFrame`, `sampleAt` (binary search), `timeToX`, `valueToY` — frame projection math. |
| `scopeHitTest.ts` | `scopeHitTest(pointer, frame)` — pure hit-test returning `HoverSelection | null`. |
| `canvasGeometry.ts` | Extracted during L1-L4 refactor to eliminate duplicated projection math between `scopeProjection` and `scopeHitTest`. |

### View components — `src/plugins/norbert-usage/views/phosphor/`

| Component | Role |
|---|---|
| `PhosphorScopeView.tsx` | Registered view container; owns `selectedMetric` React state; subscribes to `multiSessionStore`. |
| `PhosphorCanvasHost.tsx` | Sole effect component; owns canvas + persistence-buffer refs; rAF loop; ResizeObserver + DPR scaling; pointer events. |
| `PhosphorControls.tsx` | Metric segmented control (Events/s | Tokens/s | Tool-calls/s). |
| `PhosphorHoverTooltip.tsx` | Minimal tooltip DOM element; props-in. |
| `PhosphorLegend.tsx` | Color dot + session name + latest value. |
| `ensurePersistenceBuffer.ts` | Helper enforcing the persistence-buffer reset invariant (recreates on change of `{width, height, metric, DPR}`). |

### Amended modules

| Module | Amendment |
|---|---|
| `adapters/multiSessionStore.ts` | New v2 pathways: `appendRateSample`, `appendPulse`, `getRateHistory`, `getPulses`. Coexists with v1 category pathway (live importers: `hookProcessor`, `index.ts`). |
| `hookProcessor.ts` | New pure `emitPulse` helper; new rate derivation dispatch alongside existing `appendSessionSample` producer. |
| `index.ts` | View registration swapped to render `PhosphorScopeView` for `performance-monitor` view ID. |

### Tooling

- `dependency-cruiser` dev-dep added with rule `no-effects-in-phosphor-domain` forbidding `domain/phosphor/**` from importing React, adapters, views, `window`, or `document`.
- `fast-check` dev-dep added for property-based tests (IC-S11..IC-S16).

### Test surface

- **7 feature files / 58 scenarios** under `tests/acceptance/norbert-performance-monitor-v2/`:
  - `walking-skeleton.feature` (4 scenarios)
  - `milestone-1-per-session-traces.feature`
  - `milestone-2-pulses.feature`
  - `milestone-3-metric-toggle.feature`
  - `milestone-4-hover-tooltip.feature`
  - `milestone-5-session-lifecycle.feature`
  - `integration-checkpoints.feature`
- Step-definition files one-for-one under `steps/`; `fixtures.ts` shared.
- Property-based bodies (IC-S11..IC-S16) using `fc.assert(fc.property(...))`.

---

## What Was Preserved

### Untouched adjacent views

Per D6, these are out of scope for v2 and retain their v1 behavior:

- `OscilloscopeView.tsx` + `domain/oscilloscope.ts` (consumes broadcast-session `metricsStore`).
- `GaugeClusterView.tsx`, `SessionStatusView.tsx` (consume per-session `SessionMetrics` from `multiSessionStore.getSession*`).
- `CostTicker.tsx` (consumes `domain/instantaneousRate.ts` and pricing model).

### Coexistence boundary (v1 category pathway retained)

`multiSessionStore`, `hookProcessor`, and `index.ts` all retain the v1 category pathway (`appendSessionSample`, `getSessionBuffer`, `getAggregateBuffer`, etc.) because live consumers still exist outside the v2 deletion set:

- `views/PMChart.tsx` retained because `tests/acceptance/pm-chart-reliability/tooltip-crosshair-accuracy.test.ts` imports the `HoverData` interface.
- `domain/categoryConfig.ts`, `domain/heartbeat.ts`, `domain/multiWindowSampler.ts`, `domain/crossSessionAggregator.ts` retained pending v1 category pathway decommission. Grep evidence in `docs/feature/norbert-performance-monitor/deliver/upstream-issues.md`.

The `multiSessionStore` header comment documents the coexistence explicitly: *"v1 and v2 surfaces coexist on the same factory return value"*. Decommission is a follow-up step once the `pm-chart-reliability` and `pm-data-pipeline` acceptance suites are themselves retired or relocated.

### Unchanged pipeline

- Axum hook receiver → React event bus → hookProcessor → multiSessionStore chain untouched upstream.
- OTel ingest (ADR-030..ADR-038, ADR-044) unchanged.
- SQLite persistence unchanged.
- Tauri 2.0 shell, React + TypeScript + Vite frontend, Rust backend — all unchanged.
- No new runtime dependencies. Two dev-deps only: `dependency-cruiser`, `fast-check`.

---

## Metrics Captured

| Metric | Value | Target | Status |
|---|---:|---:|:---:|
| Scenarios activated (DISTILL) | 58 | 56 planned + 2 follow-up | PASS |
| Feature files | 7 | 7 | PASS |
| Step commits (DELIVER Phase 2) | 46 | — | COMPLETE |
| L1-L4 refactor commits (DELIVER Phase 3) | 4 | — | COMPLETE |
| Phase 4 review revision commits | 1 | — | COMPLETE |
| Test suite — final | 1720 passed / 103 skipped / 0 failed | 0 failed | PASS |
| `lint:boundaries` | clean | clean | PASS |
| `tsc --noEmit` | clean | clean | PASS |
| Mutation — `domain/phosphor/` aggregate kill rate | ~87% (13% survival) | ≥80% (≤20% survival) | PASS |
| Mutation — `scopeHitTest.ts` kill rate (post-remediation) | 89.89% (10.1% survival) | ≥80% (≤20% survival) | PASS |
| Mutation — `scopeProjection.ts` | 89.1% kill | ≥80% | PASS |
| Mutation — `pulseTiming.ts` | 89.5% kill | ≥80% | PASS |
| Mutation — `rateDerivation.ts` | 100% kill | ≥80% | PASS |
| Mutation — `hookProcessor.emitPulse` | 100% kill | ≥80% | PASS |
| Mutation — `multiSessionStore` v2 pathways | 82.1% kill (17.9% survival) | ≥70% (≤30% survival) | PASS |
| Overall phosphor-domain kill rate (Phase 5) | **~88%** | ≥80% | PASS |
| Memory footprint per session (5-session mix) | ~20KB + pulse log | was ~520KB (v1) | ~25× reduction |
| New runtime dependencies | 0 | minimize | PASS |

### Mutation gate journey

The initial Step 10-02 mutation run scored 82.8% overall (37 + 1 survivors on 220 mutants). `scopeHitTest.ts` was the only per-file threshold miss at 24.3% survival — 4.3 percentage points over the ≤20% AC read strictly per-file (the folder aggregate was already under threshold at 17.3%). The Phase 3 remediation added targeted edge-value scenarios (pointer at each canvas edge, sample at y=0/y=h, sample at exact cursor time, snap-distance boundary) and killed 14+ survivors without a single production-code change — confirming the survivors were exact-boundary coverage gaps, not defects. `ewma.ts` was reinstated to the mutation target list after fixing the floating-point idempotence flake in the property test.

---

## Deferred Follow-Ups

Carried forward from `docs/feature/norbert-performance-monitor/deliver/upstream-issues.md`. None block DELIVER wave close; all are scoped to future steps.

### v1-pathway decommission (the biggest carry-forward)

| File | Why it lived | What unblocks removal |
|---|---|---|
| `views/PMChart.tsx` | `pm-chart-reliability` acceptance suite imports `HoverData` interface. | Relocate `HoverData` to `domain/chartViewHelpers.ts` (one import update) **OR** retire the `pm-chart-reliability` acceptance suite. |
| `domain/categoryConfig.ts` | `multiSessionStore` v1 pathway (`appendSessionSample`, `getSessionBuffer`, `getAggregateBuffer`), `hookProcessor` producer, `index.ts` wiring, + `pm-chart-reliability` / `pm-data-pipeline` / `chartViewHelpers.test.ts` | Decide fate of `pm-chart-reliability` + `pm-data-pipeline` suites; remove v1 port methods from `multiSessionStore`; update producer in `hookProcessor`; rewire `index.ts`. |
| `domain/heartbeat.ts` | Test-only consumers: `pm-data-pipeline/cost-rate-accuracy.test.ts`, `pm-data-pipeline/heartbeat-preserves-rates.test.ts`. No live production importer. | Retire `pm-data-pipeline` acceptance tests or relocate helper. |
| `domain/multiWindowSampler.ts` | `multiSessionStore` v1 pathway imports `createMultiWindowBuffer`, `appendMultiWindowSample`, `MultiWindowBuffer` + `tests/acceptance/norbert-performance-monitor/backward-compatibility.test.ts`. | Same as `categoryConfig.ts` — bundled into the v1 decommission step. |
| `domain/crossSessionAggregator.ts` | No production importer; test-only from `norbert-performance-monitor/cross-session-aggregation.test.ts` + unit test. | Retire the aggregation acceptance suite once v2 is stable, then delete the module. |

### Residual mutants — `scopeHitTest.ts` L135/L136 (2 survivors)

After Phase 3 remediation, two mutants survive in the fallback-earliest-sample path (`<` vs `<=` comparators on sample-time ordering) when input is unsorted. The hit-test accepts pre-sorted histories by contract; the fallback only fires in a degenerate shape the production code never produces. Follow-up ticket: either prove the path is unreachable at the call site and add an invariant assertion, or add a targeted property test that exercises it.

### DISTILL follow-ups already addressed

- PO F-1 — dependency-cruiser rule for phosphor purity: **LANDED** (ADR-048, `dependency-cruiser` dev-dep, CI rule active).
- PO F-3 — IC-S11..IC-S16 rewritten to `fc.assert(fc.property(...))`: **LANDED** (`fast-check` dev-dep, IC commits 78850c5, 587f569, eb580e5).
- PA finding 1 — lifecycle notification contract: **LANDED** as Contract A (commit df5b3e3) with one IC scenario asserting `addSession`/`removeSession` notify subscribers.
- PA finding 3 — three-kind pulse ordering (tool > subagent > lifecycle): **LANDED** (commit ffc9a4f).

### `ewma.ts` / property-test idempotence

**LANDED** (commit 4b1a5d6): switched the production formula to `current + alpha * (target - current)` so `ewmaStep(v, v, α) === v` holds in IEEE-754, reinstated `ewma.ts` to the mutation target list.

---

## Lessons Learned

### 1. Anchor-job discovery can invalidate a shipped design faster than a bug report

v1 shipped on 2026-03-19. By 2026-04-17 — one month later — v2 hard-replaced it. The trigger was not a bug, a regression, or a performance complaint; it was the post-ship discovery that the high-recurrence anchor job wasn't "drill into metrics" but "feel the system breathing." v1 was well-built but answered the wrong question. The nWave DISCUSS loop post-ship is load-bearing precisely because of this: production experience is the only place where the real trigger-moment distribution surfaces. For future features, schedule an explicit post-ship discovery re-run once the feature has been lived-with for 2-4 weeks — don't wait for dissatisfaction to escalate into a bug ticket.

### 2. The "testing theater" reviewer saves you from your own seam choices

DISTILL review cycle 1 caught two specific instances where the proposed acceptance surface reached *through* the pure domain seam into view-internal effects: M3-S4's assertion on a `PersistenceBufferHandle` identity, and M3-S7's dependency on an `onMetricChange` React reducer. The pattern in both cases is the same temptation: "the observable consequence is inside the view, so let's assert on the view's internals." The SA reviewer's discipline (BLOCKER + MAJOR) forced reframing both scenarios to frame-observable consequences through `buildFrame` + `scopeHitTest` — which is the *only* seam listed in DESIGN D7. The moral: adversarial review at the DISTILL boundary is not optional, and reviewer-requested revisions on scope and seam choice should be treated as first-class gates, not style nits.

### 3. Mutation testing exposes exact-boundary coverage gaps, not defects

The `scopeHitTest.ts` initial 24.3% survival rate was alarming at first glance — 4.3pp over an ACL threshold. Root-causing revealed zero production defects and 25 survivors clustered entirely around exact-value boundary predicates: pointer at `(0, y)` / `(width, y)` / `(x, 0)` / `(x, height)`, sample at y=0 or y=height, sample at `t === cursorTime`, `verticalDistance === HOVER_SNAP_DISTANCE_PX`. The acceptance tests exercised "pointer inside" and "pointer outside" — not "pointer *at the line*." Adding four targeted scenarios killed 14+ mutants and brought the file to 10.1% survival (well under threshold) with zero production changes. Mutation testing doesn't tell you about wrong code; it tells you which boundaries your tests don't actually pin. Budget for post-mutation targeted-scenario additions as a normal Phase 3 refactor activity, not an emergency.

### 4. "Hard replace" is a durable decision when context supports it — resist re-introducing flags

D5 chose hard replace with no feature flag because (a) Phil is the sole user, (b) the view ID is preserved so window layouts resolve transparently, (c) no persistent user state exists to migrate, and (d) a feature flag is a codepath nobody ships and everyone has to remember to delete. The full 46-commit PR ran cleanly on `main` with no regressions — 1720 tests passing, boundary rules clean, types clean. The coexistence that *did* get retained (v1 category pathway in `multiSessionStore`) is not from cold feet about v2 — it's a forced retention because non-v2 acceptance suites still consume it. The lesson: distinguish "feature-flag coexistence" (almost always wrong for sole-user solo-developer contexts) from "consumer-driven coexistence" (driven by external-test imports, not by caution). The former is YAGNI debt; the latter is a genuine decommission dependency.

---

## Links to Permanent Artifacts

- **Architecture (DESIGN wave):** `docs/feature/norbert-performance-monitor/design/v2-phosphor-architecture.md`
- **ADR delta and rationale:** `docs/feature/norbert-performance-monitor/design/v2-adr-delta.md`
- **Upstream user-story disposition:** `docs/feature/norbert-performance-monitor/design/upstream-changes.md`
- **Acceptance test inventory:** `docs/feature/norbert-performance-monitor/distill/test-scenarios.md`
- **Walking skeleton spec:** `docs/feature/norbert-performance-monitor/distill/walking-skeleton.md`
- **DISTILL triple-review record:** `docs/feature/norbert-performance-monitor/distill/acceptance-review.md`
- **Deliver roadmap:** `docs/feature/norbert-performance-monitor/deliver/roadmap.json`
- **Execution log (DES):** `docs/feature/norbert-performance-monitor/deliver/execution-log.json`
- **Mutation report (Phase 5 gate):** `docs/feature/norbert-performance-monitor/deliver/mutation/mutation-report.md`
- **v1 archive:** `docs/feature/norbert-performance-monitor/deliver/v1-archive/`
- **New ADRs:** `docs/adrs/ADR-048-*.md`, `docs/adrs/ADR-049-*.md`, `docs/adrs/ADR-050-*.md`
- **Prior evolution record (v1):** `docs/evolution/2026-03-19-norbert-performance-monitor-v2.md` (confusingly named — v1 of v2 naming; this record supersedes it)
- **Research — live-signal patterns:** `docs/research/performance-monitor-live-signal-patterns.md`
- **Research — OTel telemetry shape:** `docs/research/claude-code-otel-telemetry-actual-emissions.md`
- **Discovery — anchor job and trigger-moment map:** `docs/discovery/performance-monitor-jobs.md`
- **Visual spec (phosphor prototype):** `docs/design/performance-monitor-phosphor-prototype.html`
- **Comparison aesthetics:** `docs/design/performance-monitor-aesthetics.html`

---

## Commit Range (this wave)

- **ADRs (Phase 1):** `bb157f1`..`0599a2d` (ADR-048, ADR-049, ADR-050).
- **Tooling:** `86c06b7` (dependency-cruiser).
- **Step commits (Phase 2):** `763bda1` (WS-1) through `4abeef5` (step 10-02 mutation gate).
- **Phase 3 refactor:** `4b1a5d6`, `e4d6863`, `b5bb447`, `6121a6c`.
- **Phase 4 review revision:** `e852196`.

All on `main`, not pushed at the time of finalization.
