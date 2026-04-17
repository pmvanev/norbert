# ADR-049: Performance Monitor v2 Per-Session Rate Buffers and Pulse Log

## Status

Accepted — 2026-04-17

## Context

The v1 `multiSessionStore` (ADR-008, ADR-009, ADR-026) held per-session, per-category time-series buffers across four co-equal categories — **tokens**, **cost**, **agents**, **latency** — plus a parallel aggregate buffer per applicable category that summed across sessions and a running map of `lastSessionValues` for re-aggregation. Samples were typed `CategorySample`, and `CategorySampleInput` stashed each category's numeric value into a single generic field (`RateSample.tokenRate`) with an acknowledged semantic-mismatch TODO. The `aggregateApplicable` flag (ADR-009) threaded through view code to decide whether to render or omit the aggregate panel per category.

Two forces collapse that structure:

1. **Discovery's anchor job** (`docs/discovery/performance-monitor-jobs.md`) identified **ambient aliveness** as the dominant PM use, with the three metrics the user actually glances for being **Events/s**, **Tokens/s**, and **Tool-calls/s**. Cost, agents, latency, and context no longer appear on the PM canvas in v2 (delegated to Cost Ticker / Session Status / future history views).
2. **The plan-of-record phosphor redesign** (`docs/feature/norbert-performance-monitor/design/v2-phosphor-decisions.md`, `v2-phosphor-architecture.md`) adds an event-pulse channel — per-session flares triggered by hook `PreToolUse`, `PostToolUse`, `SubagentStop`, and lifecycle events — that is structurally distinct from a rate time-series: pulses carry `strength` and `kind`, decay over 2.5s visual lifetime, and are never aggregated across sessions.

Wave decision **D1** (`docs/feature/norbert-performance-monitor/design/wave-decisions.md`) and **D10** (deprecate `heartbeat.ts` — 60fps render supplies continuous motion from data alone, no fabricated zero-fill) make the replacement decisive: v2 does not aggregate across sessions, does not need a heartbeat scaffold, and the three metric rates + pulse channel fully describe the signal.

The DISTILL wave surfaced one open contract (`docs/feature/norbert-performance-monitor/distill/wave-decisions.md`, PA-finding-1): the subscriber-notification semantics for `addSession` / `removeSession` were under-specified. Two candidates existed, and the distilled scenarios IC-S9 / IC-S10 explicitly reset the subscriber counter in setup, so post-setup lifecycle notifications were untested. DELIVER must lock the contract before adapter steps (roadmap step 02-xx onward) implement it, and step 08-08 then asserts the chosen contract in an acceptance scenario.

**Quality attribute drivers (in priority order):**

1. **Correctness of the honest-signal invariants** — rate samples reflect arrived data only; no sub-interval interpolation; no zero-fill between arrivals; trim semantics are pure and idempotent.
2. **Maintainability** — one data shape per purpose (rate vs pulse), no semantic-mismatch TODOs, functional paradigm (ADR-004) respected at the adapter boundary.
3. **Performance efficiency** — O(1) append, bounded retention, bounded memory per session; scalable to the ~5-concurrent-session working range.
4. **Testability** — store public API describable as pure-function signatures at the seam, exercisable with fake timers for the 5s rate cadence, subscriber semantics assertable without timing races.

**Constraints:**

- Functional paradigm authoritative (ADR-004). The store is an adapter (effect boundary); ring-buffer mutation is permitted there. Pure-domain modules under `domain/phosphor/*` forbidden from importing IO.
- `multiSessionStore` is a single in-process store consumed by the PM view. Subscribers are React components registered via `subscribe(callback)` and invoked to trigger re-render.
- Existing `hookProcessor` + OTel ingest pipeline (ADR-030…ADR-038, ADR-044) unchanged upstream; the store accepts derived rates and pulses from the processor, not raw events.
- The broadcast-session `metricsStore` remains additive alongside `multiSessionStore` (ADR-026, amended); the aggregate *buffers* and running sums in `multiSessionStore` are what this ADR removes, not the multi-session store itself.

## Decision

Replace the v1 category-buffer + aggregate-buffer design with a **per-session, per-metric rate buffer set** plus a **per-session pulse log**, and lock the subscriber-notification contract to **Contract A**.

### Data model

**Metric identifier — a closed discriminated union (no string soup):**

```ts
type MetricId = 'events' | 'tokens' | 'toolcalls';
```

**Rate sample — a time-value pair, no category baggage:**

```ts
type RateSample = {
  readonly t: number;  // ms since epoch (wall-clock, monotonic within session)
  readonly v: number;  // non-negative rate in the metric's unit (events/s, tokens/s, toolcalls/s)
};
```

**Pulse — an event flare distinct from a rate sample:**

```ts
type Pulse = {
  readonly t: number;      // ms since epoch
  readonly strength: number;  // [0.5, 1.0] — chosen by kind at emission
  readonly kind: 'tool' | 'subagent' | 'lifecycle';
};
```

**Per-session shape inside the store (conceptual; concrete layout is an impl detail):**

```
sessionId → {
  rates:  { events: RateBuffer, tokens: RateBuffer, toolcalls: RateBuffer },
  pulses: PulseLog,
}
```

- `RateBuffer` — append-with-cutoff list of `RateSample`, retained over a **60s rolling window**. At the 5s sampling cadence that is ~12 committed samples; with inter-tick progressive fills during derivation the committed sample count stays within **~24–36 entries** worst-case. Retention is enforced by **idempotent window trim**: calling the trim helper twice with the same `now` yields the same buffer. Append complexity O(1) amortized.
- `PulseLog` — append-with-cutoff list of `Pulse`, retained **5s** (visual lifetime is 2.5s; the extra 2.5s is a safety margin so a frame drawn near the tail never reads a pruned pulse). Pruning is idempotent by the same contract.

### Public store API

```ts
// Writes (from hookProcessor)
appendRateSample(sessionId: SessionId, metric: MetricId, sample: RateSample): void;
appendPulse(sessionId: SessionId, pulse: Pulse): void;

// Lifecycle
addSession(sessionId: SessionId): void;
removeSession(sessionId: SessionId): void;

// Reads (from PhosphorCanvasHost and selectors)
getSessionIds(): ReadonlyArray<SessionId>;
getRateHistory(sessionId: SessionId, metric: MetricId): ReadonlyArray<RateSample>;
getPulses(sessionId: SessionId): ReadonlyArray<Pulse>;

// Pub/sub
subscribe(callback: () => void): Unsubscribe;
```

The v1 methods `appendSessionSample(categorySamples)`, `getCategoryBuffer(category)`, and aggregate-buffer readers are **removed**, not deprecated — no consumers remain after the v2 PR (all v1 PM views are deleted per ADR-048).

### Subscriber-notification contract — Contract A (chosen)

> **`addSession` and `removeSession` notify subscribers.** Lifecycle changes propagate through the same pub/sub channel as `appendRateSample` and `appendPulse`.

Rationale for choosing Contract A as the default:

1. **One subscription covers re-render triggers for all store mutations.** The PM view needs to re-render when sessions appear/disappear (the `PhosphorLegend` must add/remove a color swatch; the canvas must start/stop drawing a trace). Under Contract A the existing subscribe callback already covers that path; under Contract B the view must additionally compare a `getSessionIds()` snapshot frame-to-frame or keep a parallel lifecycle listener — more state, more branches.
2. **Consistent mental model.** Every state change that a subscriber could care about is a pub/sub notification. This is the uniform Redux/Zustand-shape contract that React developers expect from a lightweight store and that our other in-process stores already follow.
3. **Testability.** Contract A expresses as a single invariant — "after any state-mutating public method, subscribers receive at least one notification within the tick." That is a direct property-test candidate. Contract B requires two invariants with disjoint branches (sample/pulse path notifies; lifecycle path does not notify but does change `getSessionIds()`), which doubles the assertion surface and invites races.
4. **No material cost.** Under Contract A, `addSession` / `removeSession` fire one notification each. At the expected cadence (sessions open/close on human timescales, not per-frame), the notification fan-out is negligible and the view's re-render is already debounced by React's scheduler.

Roadmap step **08-08** carries a deferred acceptance scenario that asserts Contract A without counter-resets in setup — the DISTILL PA-finding-1 resolution action item.

### Memory budget

Per session, per metric buffer at 5s cadence × 60s window = **~12 samples committed** (30 worst-case including mid-tick progressive fills) × `{ t: number; v: number }` ≈ 16 bytes logical + object overhead ≈ **~1 KB per buffer** budgeted generously. Three metrics × ~1 KB = **~3 KB per session for rates**. Pulse log at worst ~20 pulses × ~24 bytes ≈ **~0.5 KB per session for pulses**. Rounded up with per-session object overhead:

- **v1 (per-category-buffers × multi-window):** 5 sessions × 4 categories × 3 windows × 900-sample ring ≈ **~520 KB** at the stated footprint.
- **v2 (per-metric rate buffers + pulse log):** 5 sessions × 3 metrics × ~30-sample ring + ~20 pulses ≈ **~20 KB**.

That is approximately a **25× memory reduction** for the 5-concurrent-session working case, in addition to the algorithmic simplification from dropping aggregate recomputation. No additional heap allocations on the hot path — all canvas-frame draws read the buffers in place.

## Alternatives Considered

### Alternative 1: Keep the existing `CategorySample` shape, add two categories (`events`, `toolcalls`)

- **What:** Retain the v1 `CategorySample` / `CategorySampleInput` types and their routing through `appendSessionSample`. Add new `MetricCategoryId` entries for `events` and `toolcalls`, possibly demoting the three v1 categories that v2 no longer displays (cost, agents, context) to a vestigial state or deleting them from the config.
- **Tradeoff:** Minimizes the v2 migration diff in `multiSessionStore`. Preserves the `aggregateApplicable` machinery for potential future aggregation.
- **Why rejected:**
  1. **Entrenches the `RateSample.tokenRate` semantic-mismatch TODO** (acknowledged in ADR-008's own `CategorySample` field comment). A sample called `tokenRate` that actually carries toolcalls-per-second is a bug magnet and forces every read site to re-narrow the field.
  2. **Keeps aggregate buffers + `aggregateApplicable` + `lastSessionValues` in the store** even though no v2 consumer reads them — dead code with live cost. The aggregate-recompute path executes on every append.
  3. **The pulse channel does not fit** inside the `CategorySample` model. Pulses carry `strength` and `kind`; a hacked field (`CategorySample.pulseStrength`) would reproduce exactly the semantic-mismatch pattern we are trying to eliminate.
  4. **Closed discriminated union is stronger typing than an open category registry.** v2's three metrics are a bounded set by design; a `MetricId` union makes illegal metric names unrepresentable at compile time, whereas the v1 category registry accepts any string key.

### Alternative 2: Compute rates in the view each frame from the raw event stream

- **What:** Do not store rate buffers in the adapter at all. On each 60fps render, have `PhosphorCanvasHost` walk the raw hook-event / OTel-arrival stream (or a minimal event ring) and bucket into 5s windows on the fly to derive Events/s, Tokens/s, Tool-calls/s.
- **Tradeoff:** Collapses the store responsibility: the store would be a thin event log plus pulse log; all derivation lives next to the draw.
- **Why rejected:**
  1. **Violates the functional-paradigm effect-boundary rule (ADR-004, wave decision D4).** Derivation is pure and belongs in `domain/*`; the effect component (`PhosphorCanvasHost`) becomes the derivation engine, which is the exact inversion the paradigm forbids.
  2. **60× repeated work per second.** 5s-window bucketing 60 times per second per session is pure CPU waste — the same bucket recomputed every frame.
  3. **Hit-test becomes harder to unit-test.** `scopeHitTest` receives a `Frame` that is the derivation output; if derivation is in the view, the test double must reproduce a full event stream rather than a small buffer of committed samples.
  4. **Subscriber semantics become ambiguous.** Subscribers would have to re-run derivation to know whether the rendered frame changed; this is the opposite of the clear "store mutated → notify" contract.

### Alternative 3: Per-metric rate buffers + keep aggregate buffers for a future "summed totals" view

- **What:** Adopt the `RateBuffer` + `PulseLog` shape for v2 but retain v1's aggregate buffers (now per-metric rather than per-category) on the assumption a future view will want "total throughput across all sessions."
- **Tradeoff:** Forward-compatibility with a hypothetical aggregate view. Memory cost is bounded.
- **Why rejected:**
  1. **YAGNI.** The plan-of-record explicitly rules out cross-session aggregation for the PM; no user story in-scope, adjacent, or near-term demands a summed-totals view. The Cost Ticker serves the only confirmed cross-session use case, and it does not need an aggregate rate buffer.
  2. **Aggregate recompute is not free.** Every `appendRateSample` currently triggers a `lastSessionValues[session, metric] = v` write plus an aggregate-buffer update. Retaining that machinery for a speculative future consumer means paying its cost every tick today.
  3. **Complicates the subscriber-notification contract.** Aggregate buffers are derived state; if they are notified separately from per-session buffers, Contract A / B decision becomes three-way. Eliminating them eliminates that complication.
  4. **Re-introduction is cheap if needed.** If a future view genuinely needs summed-totals, a pure selector `aggregateRates(sessionIds, metric, now)` over the per-session buffers is a one-afternoon addition — no store-shape change required. The correct YAGNI move is to defer.

### Alternative 4: Keep one unified buffer per session holding a structured sample `{ events, tokens, toolcalls }` at each tick

- **What:** Instead of three independent `RateBuffer`s per session, store one `MultiRateSample` buffer where each entry is `{ t: number; events: number; tokens: number; toolcalls: number }`.
- **Tradeoff:** Fewer buffers to manage (one per session, not three). Samples arrive aligned by timestamp.
- **Why rejected:**
  1. **Metric toggle semantics become awkward.** The view reads one metric at a time; with a unified sample the read-path must project a field per frame. With independent buffers the view reads the exact shape it draws.
  2. **Trim is coupled across metrics.** If one metric's derivation falls behind (e.g., tokens ticks but toolcalls does not), the unified structure either stalls all metrics or fills unavailable slots with sentinel values — either forces an interpolation decision the honest-signal invariant forbids.
  3. **Breaks alignment with the pure domain.** `domain/phosphor/rateDerivation.ts` computes one metric at a time; pushing a unified sample forces a shim between the domain and the adapter for no benefit.
  4. **Marginal memory savings, meaningful clarity loss.** Three number pointers vs one struct pointer is not a measurable win at this volume.

## Consequences

- **Positive** — Resolves the `CategorySample` semantic-mismatch TODO (ADR-008) structurally by replacing the category abstraction with a closed `MetricId` union. Each metric gets its own buffer; no field re-purposing.
- **Positive** — Removes `aggregateBuffers`, `aggregateMultiWindowBuffers`, `aggregateSums`, `aggregateApplicable`, and `lastSessionValues` from the store. ADR-009's `aggregateApplicable` flag becomes moot — there is no aggregate to opt out of.
- **Positive** — **Memory budget drops ~25×:** v1 ~520 KB → v2 ~20 KB for 5 concurrent sessions. The saving is almost entirely from eliminating the per-category × multi-window aggregate buffers (ADR-027's multi-window is separately removed in ADR-050).
- **Positive** — Public API is a small, teachable surface: four writes (`addSession`, `removeSession`, `appendRateSample`, `appendPulse`), three reads (`getSessionIds`, `getRateHistory`, `getPulses`), one subscribe. Mutation testing has a small, high-value target.
- **Positive** — Subscriber-notification contract is **explicit (Contract A)** and testable as a single invariant. DISTILL PA-finding-1 is resolved; step 08-08 will assert it.
- **Positive** — Pulse channel is first-class, not a category hack. Pulse decay is a pure function (`domain/phosphor/pulseTiming.ts`) that operates on `ReadonlyArray<Pulse>` — no view-side event accumulation.
- **Positive** — Aligns the store shape 1:1 with the prototype (`docs/design/performance-monitor-phosphor-prototype.html`), shrinking the prototype-to-production translation gap and the surface where behavior can drift.
- **Negative** — The v2 PR contains a breaking change to `multiSessionStore` public API. Acceptable because the only PM views that called `appendSessionSample` or read category buffers are deleted in the same PR (ADR-048). The broadcast-session `metricsStore` is unaffected.
- **Negative** — Contract A has a small performance cost under rapid session churn: every `addSession` / `removeSession` fan-outs to subscribers. At the expected cadence (sessions open/close on human timescales) this is negligible; for adversarial test scenarios (e.g., fast fixture teardown) the contract holds correctly even if it triggers extra notifications.
- **Negative** — Callers that want a "total throughput across sessions" figure in the future must compute it via a selector; it is no longer a pre-maintained buffer. Accepted under YAGNI.
- **Neutral** — The ring-buffer vs append-with-cutoff-list implementation choice is left to the adapter author; either satisfies the O(1) append and the idempotent-trim invariant. The public API does not leak the choice.

## Supersedes / Amends

- **Supersedes ADR-008** (`ADR-008-per-session-category-time-series-buffers.md`) — the per-session × per-category buffer scheme (4 categories: tokens / cost / agents / latency) is removed. v2 stores per-session × per-metric rate buffers keyed on the closed `MetricId` union (`events` / `tokens` / `toolcalls`). The `CategorySample` / `CategorySampleInput` types and their `RateSample.tokenRate` semantic-mismatch TODO are retired.
- **Supersedes ADR-009** (`ADR-009-aggregate-applicability-by-category.md`) — the `aggregateApplicable: boolean` flag on the category configuration is removed along with the aggregate-buffer machinery it gated. v2 does not aggregate across sessions; every trace is per-session and rendered individually on a single overlaid canvas. The decision the flag was engineered to support ("omit aggregate when not applicable") no longer exists as a branch in the code path.
- **Amends ADR-026** (`ADR-026-pm-multi-session-aggregation.md`) — the `multiSessionStore` additive to the broadcast-session `metricsStore` is retained, but the store's responsibilities shrink. Specifically: aggregate buffers, aggregate multi-window buffers, aggregate sums, and the `lastSessionValues` re-aggregation map are removed from `multiSessionStore`. The store continues to host per-session state (now rates + pulses instead of categories) and the subscribe/notify mechanism. Recommend updating ADR-026's status line to: "Accepted (amended 2026-04-17: aggregate buffers and aggregate sums removed for v2, per ADR-049)."

Related dispositions (captured in `v2-adr-delta.md`): **ADR-027** (multi-window time-series buffers) is superseded by **ADR-050** — v2 uses a single fixed 60s window; the multi-window selector is removed. **ADR-048** (phosphor scope view architecture) is the companion view-layer decision that deletes the v1 PM component tree and establishes the `PhosphorScopeView` shell this store feeds.
