# DISTILL → DELIVER Handoff (Performance Monitor v2 Phosphor Scope)

**From:** DISTILL wave (acceptance-designer, 2026-04-17 — this document supersedes the v1-shaped handoff dated 2026-03-18.)
**To:** DELIVER wave (nw-functional-software-crafter)
**Feature:** `norbert-performance-monitor` v2 (phosphor-scope redesign)
**Paradigm:** functional (per `CLAUDE.md`)
**Anchor job:** ambient aliveness — "are my agents alive and churning?"

---

## 1. Inputs the Crafter Should Read First

Read in this order; stop if any contradict each other and flag back:

1. `docs/feature/norbert-performance-monitor/design/v2-phosphor-decisions.md` — plan-of-record (anchor job, aesthetic, metric toggle, hover contract, view slot, replacement scope).
2. `docs/feature/norbert-performance-monitor/design/v2-phosphor-architecture.md` — C4 diagrams and the seven resolved architecture questions. §5 Q1 (derivation pipeline), Q3 (canvas + persistence buffer), Q4 (pure-module list + effect boundaries), Q7 (test seam) are the load-bearing sections.
3. `docs/feature/norbert-performance-monitor/design/v2-adr-delta.md` — ADR-048, ADR-049, ADR-050 sketched. Author these as part of the DELIVER PR.
4. `docs/feature/norbert-performance-monitor/design/upstream-changes.md` — user-story supersessions. Scope bound is US-PM-001 (amended) + US-PM-007 (amended).
5. `docs/feature/norbert-performance-monitor/design/wave-decisions.md` — D1..D10 summary.
6. `docs/discovery/performance-monitor-jobs.md` — anchor job + anti-jobs.
7. `docs/research/performance-monitor-live-signal-patterns.md` — honest-signal invariants (no sub-interval spike; no zero-fill between arrivals).
8. `docs/design/performance-monitor-phosphor-prototype.html` — visual spec.
9. This handoff + `test-scenarios.md` + `walking-skeleton.md` + `acceptance-review.md` in the same `distill/` directory.

---

## 2. Modules to Author

All modules under `src/plugins/norbert-usage/`. Paths relative to that root.

### 2.1 New pure domain modules (under `domain/phosphor/`)

| Module | Responsibility | Key Exports |
|---|---|---|
| `domain/phosphor/phosphorMetricConfig.ts` | Metric id → name/unit/yMax/caption; session color palette. Pure data. | `METRICS: Record<MetricId, MetricConfig>`; `SESSION_COLORS: readonly string[]` (≥ 5 entries) |
| `domain/phosphor/rateDerivation.ts` | Convert event counts / token deltas into per-tick rate samples. | `deriveEventsRate(count, windowMs, tickBoundaryT): RateSample`; `deriveTokensRate(totalTokens, durationMs, tickBoundaryT): RateSample`; `deriveToolCallsRate(count, windowMs, tickBoundaryT): RateSample` |
| `domain/phosphor/ewma.ts` | Smoothing step with target attraction (prototype parity). | `ewmaStep(current, target, alpha): number` |
| `domain/phosphor/pulseTiming.ts` | Pulse age → decay factor; prune-stale helpers. | `decayFactor(ageMs, lifetimeMs): number`; `prunePulses(log, now, cutoffMs): readonly Pulse[]` |
| `domain/phosphor/scopeProjection.ts` | Pure projection: store + metric + now → Frame. Includes `sampleAt`, `timeToX`, `valueToY`. | `buildFrame(store, metric, now): Frame`; internal helpers `sampleAt`, `timeToX`, `valueToY` |
| `domain/phosphor/scopeHitTest.ts` | Pure hit-test. | `scopeHitTest(pointer, frame): HoverSelection | null` |

### 2.2 Adapter changes (amend in place)

| Module | Action | Key Shape |
|---|---|---|
| `adapters/multiSessionStore.ts` | Replace category-based buffers with per-metric rate buffers + per-session pulse log, per ADR-049. | New public methods: `appendRateSample(sessionId, metric, t, v)`, `appendPulse(sessionId, pulse)`, `getRateHistory(sessionId, metric): readonly RateSample[]`, `getPulses(sessionId): readonly Pulse[]`, `getSessionIds(): readonly string[]`. Preserve `addSession`, `removeSession`, `subscribe`. Pulse retention = 5s; rate history window-trim = 60s (idempotent on read). |

### 2.3 Ingest-seam helpers (amend in place)

| Module | Action | Key Exports |
|---|---|---|
| `hookProcessor.ts` | Replace `deriveCategorySamples` with per-metric derivers + pulse emitter. | `deriveEventsRate` / `deriveTokensRate` / `deriveToolCallsRate` (re-export from `domain/phosphor/rateDerivation.ts`) + `emitPulse(kind, t): Pulse`. Retain the OTel-active switching logic. |

### 2.4 Effect / view components (under `views/phosphor/`)

These are not directly exercised by the acceptance suite (the seam is the pure domain layer). They are needed for the skeleton to be user-demoable.

| Component | Role |
|---|---|
| `views/phosphor/PhosphorScopeView.tsx` | React shell — owns `selectedMetric` state, subscribes to `multiSessionStore`, composes Controls + CanvasHost + HoverTooltip + Legend. |
| `views/phosphor/PhosphorCanvasHost.tsx` | Sole effect component — owns canvas ref + persistence-buffer ref, rAF loop, ResizeObserver, DPR, pointer events. Calls `buildFrame` per frame and `scopeHitTest` per `mousemove`. Must implement `ensurePersistenceBuffer(w, h, metric, dpr)` with the invariant: buffer invalidated when any of (w, h, metric, dpr) changes. |
| `views/phosphor/PhosphorControls.tsx` | Segmented control: Events/s \| Tokens/s \| Tool-calls/s. Default = Events/s. |
| `views/phosphor/PhosphorHoverTooltip.tsx` | React DOM — renders `session · value unit · time-ago`. Edge-flipping allowed. |
| `views/phosphor/PhosphorLegend.tsx` | Color dot + session name + latest value per session. |

### 2.5 Registration (amend in place)

| Module | Action |
|---|---|
| `src/plugins/norbert-usage/index.ts` | Point the `performance-monitor` view ID at `PhosphorScopeView`. View ID string unchanged. |

### 2.6 Deletions (end of PR)

- `views/PerformanceMonitorView.tsx`, `views/PMSidebar.tsx`, `views/PMChart.tsx`, `views/PMDetailPane.tsx`, `views/PMStatsGrid.tsx`, `views/PMSessionTable.tsx`, `views/PMTooltip.tsx` — all v1 PM view components.
- `domain/categoryConfig.ts`, `domain/heartbeat.ts`, `domain/multiWindowSampler.ts` — after grep-verified no remaining consumers outside the PM scope.
- `domain/crossSessionAggregator.ts` — delete only if no non-PM view imports it (grep during DELIVER).
- V1 PM acceptance tests under `tests/acceptance/norbert-performance-monitor-v2/` (the `.test.ts` files NOT under `steps/` — `category-configuration.test.ts`, `chart-renderer.test.ts`, `hover-tooltip.test.ts`, `sidebar-and-detail-layout.test.ts`, `per-session-category-buffers.test.ts`) — delete or migrate; they describe the v1 behavior under the same directory name and will regress as soon as the v1 code is removed. The v2 suite lives in `steps/` and `*.feature` files alongside.

---

## 3. Seam / Driving-Port Signatures (Reference)

Sourced from `tests/acceptance/norbert-performance-monitor-v2/steps/fixtures.ts`.

```ts
type MetricId = "events" | "tokens" | "toolcalls";

interface RateSample { readonly t: number; readonly v: number; }

type PulseKind = "tool" | "subagent" | "lifecycle";
interface Pulse { readonly t: number; readonly strength: number; readonly kind: PulseKind; }
// strength: tool=1.0, subagent=0.75, lifecycle=0.5

interface Frame {
  readonly now: number;
  readonly metric: MetricId;
  readonly yMax: number;
  readonly unit: string;
  readonly traces: readonly FrameTrace[];
  readonly pulses: readonly FramePulse[];
  readonly legend: readonly LegendEntry[];
}
interface FrameTrace {
  readonly sessionId: string;
  readonly color: string;
  readonly samples: readonly { readonly t: number; readonly v: number }[];
  readonly latestValue: number | null;
}
interface FramePulse {
  readonly sessionId: string;
  readonly t: number;
  readonly v: number;     // trace value at pulse time (vertical position)
  readonly decay: number; // 1 = fresh, 0 = at lifetime boundary
  readonly strength: number;
  readonly kind: PulseKind;
  readonly color: string;
}
interface LegendEntry {
  readonly sessionId: string;
  readonly color: string;
  readonly latestValue: number | null;
}

interface HoverSelection {
  readonly sessionId: string;
  readonly color: string;
  readonly value: number;
  readonly time: number;
  readonly ageMs: number;
  readonly displayX: number;
  readonly displayY: number;
}

interface MultiSessionStoreSurface {
  addSession(sessionId: string): void;
  removeSession(sessionId: string): void;
  appendRateSample(sessionId: string, metric: MetricId, t: number, v: number): void;
  appendPulse(sessionId: string, pulse: Pulse): void;
  getRateHistory(sessionId: string, metric: MetricId): readonly RateSample[];
  getPulses(sessionId: string): readonly Pulse[];
  getSessionIds(): readonly string[];
  subscribe(cb: () => void): () => void;
}

// Pure domain seam:
function buildFrame(store: MultiSessionStoreSurface, metric: MetricId, now: number): Frame;
function scopeHitTest(
  pointer: { x: number; y: number; width: number; height: number },
  frame: Frame,
): HoverSelection | null;

// Pulse timing (pure):
function decayFactor(ageMs: number, lifetimeMs: number): number;

// hookProcessor derivations (pure):
function deriveEventsRate(count: number, windowMs: number, tickBoundaryT: number): RateSample;
function deriveTokensRate(totalTokens: number, durationMs: number, tickBoundaryT: number): RateSample;
function deriveToolCallsRate(count: number, windowMs: number, tickBoundaryT: number): RateSample;
function emitPulse(kind: PulseKind, t: number): Pulse;
```

Invariants (enforced via acceptance tests; crafter must preserve):

- **Honest smoothing:** `buildFrame` trace samples are bounded by the nearest two arrived samples (no sub-interval spike).
- **No zero-fill:** if the most recent arrived value for a session is non-zero and no newer sample has arrived, the trace at the current-time edge equals that last arrived value, not zero.
- **Window discipline:** any sample older than 60s ago is excluded from trace projection. Idempotent across repeat reads.
- **Pulse lifetime:** pulses with age > 2.5s are absent from `frame.pulses` even if still retained in the store.
- **Pulse retention:** pulses with age > 5s are absent from `store.getPulses(id)`.
- **Persistence-buffer reset:** the effect-side `ensurePersistenceBuffer(w, h, metric, dpr)` inside `PhosphorCanvasHost` must discard and recreate the offscreen persistence buffer whenever any of (width, height, metric, dpr) changes, so prior-metric afterglow cannot bleed into the new scale. Note: this is a view-internal invariant enforced at DELIVER time by a unit test of `PhosphorCanvasHost`; the acceptance test M3-S4 observes only the frame-level consequence through `buildFrame` (post-toggle `Frame.yMax` is the new metric's scale and the new frame carries no sample values from the prior metric's history).

Constants (from `fixtures.ts`, matching prototype): `WINDOW_MS = 60_000`, `RATE_TICK_MS = 5_000`, `PULSE_LIFETIME_MS = 2_500`, `PULSE_RETENTION_MS = 5_000`, `HOVER_SNAP_DISTANCE_PX = 28`. YMax per metric: events=15, tokens=100, toolcalls=3.

---

## 4. Activation Order (One Scenario at a Time)

Each step-def file has exactly one first scenario active (un-skipped, red with `ReferenceError`). Activate in this order. Implement driving-port code + any inner unit tests needed to green the current scenario, commit, un-skip the next, repeat.

**Phase A — Core projection + store (walking skeleton WS-1).**
1. `steps/walking-skeleton.test.ts` — un-skip WS-1. Implement `domain/phosphor/phosphorMetricConfig.ts`, `domain/phosphor/scopeProjection.ts` (at least skeletal `buildFrame`), and the v2-shape `multiSessionStore.ts` (`addSession`, `appendRateSample`, `getRateHistory`, `getSessionIds`, `subscribe`). WS-1 green = the core rendering pipeline is real.

**Phase B — Pulse side (walking skeleton WS-2).**
2. `steps/walking-skeleton.test.ts` — un-skip WS-2. Implement `domain/phosphor/pulseTiming.ts`, extend `buildFrame` to project pulses, extend `multiSessionStore` with `appendPulse` / `getPulses`. Pulse retention = 5s enforced at read time.

**Phase C — Metric toggle (walking skeleton WS-3).**
3. `steps/walking-skeleton.test.ts` — un-skip WS-3. Verify per-metric buffer separation works (the `metric` argument to `buildFrame` already makes this straightforward if the store keys buffers by `(sessionId, metric)`).

**Phase D — Hover (walking skeleton WS-4).**
4. `steps/walking-skeleton.test.ts` — un-skip WS-4. Implement `domain/phosphor/scopeHitTest.ts`.

**Phase E — Focused rendering scenarios.**
5-11. `steps/milestone-1-per-session-traces.test.ts` — un-skip M1-S1 first (already active as the first red). Work through M1-S2 (bracketing invariant), M1-S3 (flatline), M1-S4 (empty trace), M1-S5 (60s window), M1-S6 (5-color palette), M1-S7 (no sessions).

**Phase F — Focused pulse scenarios.**
12-19. `steps/milestone-2-pulses.test.ts` — un-skip M2-S1..S8 in order. S2 (mid-life decay), S3 (kind strength), S4 (multiple pulses), S5 (lifetime cutoff), S6 (retention trim), S7 (value-on-trace), S8 (pulse without history).

**Phase G — Metric toggle boundary + error scenarios.**
20-26. `steps/milestone-3-metric-toggle.test.ts` — un-skip M3-S1..S7 in order. S4 (persistence buffer) is observable through `buildFrame` alone (post-toggle frame uses the new metric's yMax and carries no prior-metric sample values); DELIVER must additionally add a view-internal unit test of `PhosphorCanvasHost.ensurePersistenceBuffer` for the effect-level invariant. S7 (hover-clear) is observable through `buildFrame` + `scopeHitTest` (same pointer position yields non-null selection on the events-scale frame and null on the tokens-scale frame).

**Phase H — Hover boundary + error scenarios.**
27-34. `steps/milestone-4-hover-tooltip.test.ts` — un-skip M4-S1..S8 in order.

**Phase I — Lifecycle + window boundary.**
35-40. `steps/milestone-5-session-lifecycle.test.ts` — un-skip M5-S1..S6 in order.

**Phase J — Derivation + store contract + properties.**
41-56. `steps/integration-checkpoints.test.ts` — un-skip IC-S1..S16 in order. IC-S11..S16 are property-shaped; DELIVER replaces their representative-case bodies with `fc.assert(fc.property(...))` using fast-check (added as a dev-dep in this PR).

**Phase K — Deletions + ADR authoring.**
- Author ADR-048, ADR-049, ADR-050 (text sketched in `v2-adr-delta.md`).
- Delete v1 PM view components (`views/PerformanceMonitorView.tsx` etc.).
- Delete / grep-verify `categoryConfig`, `heartbeat`, `multiWindowSampler`, `crossSessionAggregator`.
- Delete v1 `*.test.ts` files directly under `tests/acceptance/norbert-performance-monitor-v2/` (the non-`steps/` files listed in §2.6); they describe v1 behavior.
- Add `dependency-cruiser` dev-dep + boundary rule forbidding `domain/phosphor/**` from importing `react`, `adapters/**`, `views/**`, `window`, `document`, or `domain/oscilloscope.ts` (the last line enforces US-PM-007's amended AC per `acceptance-review.md` §Scope Discipline).

---

## 5. Mutation-Testing Targets

Per `CLAUDE.md` per-feature mutation testing:

- `src/plugins/norbert-usage/domain/phosphor/*.ts` — entire sub-folder. Target: ≤ 20% surviving mutants.
- `src/plugins/norbert-usage/adapters/multiSessionStore.ts` — new rate-sample + pulse pathways only (existing session-lifecycle code is outside the v2 delta). Target: ≤ 30% surviving mutants.
- `src/plugins/norbert-usage/hookProcessor.ts` — the new `deriveEvents/deriveTokens/deriveToolCalls/emitPulse` helpers. Target: ≤ 20% surviving mutants.

Run after all acceptance scenarios are green.

---

## 6. Smoke-Test Evidence (Gate from DISTILL)

Run, at DISTILL → DELIVER boundary:

```bash
npx vitest run tests/acceptance/norbert-performance-monitor-v2/ --reporter=verbose
```

Recorded result (2026-04-17):
- **6 failures**, one per new step-def file, each a `ReferenceError` on a distinct not-yet-implemented driving port:
  - `milestone-1-per-session-traces.test.ts` → `createMultiSessionStore is not defined`
  - `milestone-2-pulses.test.ts` → `createMultiSessionStore is not defined`
  - `milestone-3-metric-toggle.test.ts` → `createMultiSessionStore is not defined`
  - `milestone-4-hover-tooltip.test.ts` → `createMultiSessionStore is not defined`
  - `milestone-5-session-lifecycle.test.ts` → `createMultiSessionStore is not defined`
  - `integration-checkpoints.test.ts` → `deriveEventsRate is not defined`
- **50 skipped** scenarios (via `describe.skip`) — one-at-a-time TDD discipline.
- **1 file** fully skipped by original author design (`walking-skeleton.test.ts`).
- **0 fixture/import/syntax failures.** Fixtures from `steps/fixtures.ts` load cleanly.

Interpretation: each failing scenario has an active assertion that needs a real driving port. The DELIVER crafter green-lights each by implementing the named driving port (inner TDD loop: pure-function unit tests first, then wiring).

---

## 7. Test Suite Totals

| File | Scenarios | Walking skeletons | Happy-path focused | Error/boundary | Property-shaped |
|---|---|---|---|---|---|
| walking-skeleton.feature | 4 | 4 | — | — | — |
| milestone-1-per-session-traces.feature | 7 | — | 3 | 4 | — |
| milestone-2-pulses.feature | 8 | — | 4 | 4 | — |
| milestone-3-metric-toggle.feature | 7 | — | 3 | 4 | — |
| milestone-4-hover-tooltip.feature | 8 | — | 3 | 5 | — |
| milestone-5-session-lifecycle.feature | 6 | — | 3 | 3 | — |
| integration-checkpoints.feature | 16 | — | 10 (derivations + store contract) | — | 6 |
| **Total** | **56** | **4** | **26** | **20** | **6** |

Across focused (non-skeleton) scenarios: **error/boundary share = 20/52 ≈ 38%**, within target corridor given the integration-checkpoints file's derivation focus. Including the 6 property-shaped scenarios (which function as invariant boundaries): 26/52 = 50%.

---

## 8. Upstream Issues Found (Flags for Orchestrator)

None that block DELIVER.

Non-blocking calls:

1. **US-PM-007's amended AC is structural, not behavioral.** Covered best by a `dependency-cruiser` rule rather than a Gherkin scenario. Added to §4 Phase K. Noted in `acceptance-review.md` §Scope Discipline.
2. **IC-S11..S16 are property-shaped.** Acceptance tests contain a representative-case body as a stand-in; DELIVER swaps them for `fc.assert(fc.property(...))`. Noted in `test-scenarios.md`.
3. **View-internal invariants (persistence-buffer reset, hover clear on metric change) are observed in acceptance tests through the pure domain seam only.** M3-S4 asserts frame-observable consequences via `buildFrame` (post-toggle `Frame.yMax` is the new metric's scale; no prior-metric sample values appear in the post-toggle frame). M3-S7 asserts through `buildFrame` + `scopeHitTest` (same pointer position hits the events-scale trace but produces no selection on the tokens-scale frame). DELIVER must additionally add DELIVER-wave unit tests for the view-internal effects: `PhosphorCanvasHost.ensurePersistenceBuffer(w, h, metric, dpr)` must discard-and-recreate when any key changes, and the `PhosphorScopeView` hover state must clear on `selectedMetric` change. (Revised 2026-04-17 rev 1 per SA reviewer — the earlier abstract view-reducer surfaces `onMetricChange` / `PersistenceBufferHandle` were removed from the acceptance test surface.)

---

## 9. Definition of Done (for DELIVER to close out)

The DELIVER wave closes when:

- [ ] All 56 scenarios enabled and green.
- [ ] Property-shaped scenarios (IC-S11..S16) replaced with fast-check property implementations.
- [ ] Mutation-testing thresholds met per §5.
- [ ] ADR-048 / ADR-049 / ADR-050 authored under `docs/adrs/`.
- [ ] V1 PM files deleted per §2.6.
- [ ] `dependency-cruiser` boundary rule added and passing in CI.
- [ ] Phil validates the built plugin against the prototype visually (anchor-job peripheral glance).

Phil is the sole user; stakeholder validation is Phil's eye on the running plugin plus the green suite.
