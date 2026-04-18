# DISTILL Wave — Test Scenarios (Performance Monitor v2 Phosphor Scope)

**Wave:** DISTILL (acceptance-designer)
**Date:** 2026-04-17
**Feature:** `norbert-performance-monitor` v2 (phosphor-scope redesign)
**Scope:** US-PM-001 (amended) + US-PM-007 (amended) + v2-specific behaviors (metric toggle, pulses, hover tooltip, session lifecycle) per `../design/upstream-changes.md`.

All scenarios are stored as Gherkin `.feature` files in `tests/acceptance/norbert-performance-monitor-v2/` and as Vitest step-def `.test.ts` files in `tests/acceptance/norbert-performance-monitor-v2/steps/`. Driving ports are the pure domain seam `buildFrame(store, metric, now)` + `scopeHitTest(pointer, frame)` plus the `multiSessionStore` adapter's `appendRateSample` / `appendPulse` / `getRateHistory` / `getPulses` / `addSession` / `removeSession` / `subscribe` surface, per `../design/wave-decisions.md` D7 and `../design/v2-phosphor-architecture.md` §5.Q7.

---

## Scenario Inventory

| # | Scenario | Feature File | Tags | Trace | Driving Port | Status |
|---|---|---|---|---|---|---|
| WS-1 | User glances at the scope and sees two sessions alive and churning | walking-skeleton | `@walking_skeleton @driving_port @US-PM-001` | US-PM-001 amended | buildFrame, multiSessionStore.appendRateSample, addSession | skip |
| WS-2 | User sees a fresh hook event flare as a pulse on its session's trace | walking-skeleton | `@walking_skeleton @driving_port @US-PM-001` | US-PM-001 amended; anchor job (pulses) | buildFrame, multiSessionStore.appendPulse | skip |
| WS-3 | User switches the metric and the scope re-projects with the new scale | walking-skeleton | `@walking_skeleton @driving_port @US-PM-001` | US-PM-001 amended; D3 (persistence buffer reset) | buildFrame | skip |
| WS-4 | User hovers over a trace and a tooltip identifies the session, value, and age | walking-skeleton | `@walking_skeleton @driving_port @US-PM-001` | US-PM-001 amended; Q7 hover contract | scopeHitTest, buildFrame | skip |
| M1-S1 | Each active session gets its own color identity on the scope | milestone-1-per-session-traces | `@driving_port @US-PM-001` | v2 arch Q1 (per-session traces); ADR-049 | buildFrame | **active (red)** |
| M1-S2 | A trace samples its session's arrived rate history across the window | milestone-1-per-session-traces | `@driving_port @US-PM-001` | Honest-signal invariant (no sub-interval spike) | buildFrame | skip |
| M1-S3 | A stalled session shows a flatline from the last arrived value, not a drop to zero | milestone-1-per-session-traces | `@driving_port @US-PM-001` | Honest-signal invariant (no zero-fill); D10 | buildFrame | skip |
| M1-S4 | A session with no arrived history yet produces an empty trace | milestone-1-per-session-traces | `@driving_port @US-PM-001` | v2 arch Q1 boundary case | buildFrame | skip |
| M1-S5 | Samples older than the 60-second window are excluded from the trace | milestone-1-per-session-traces | `@driving_port @US-PM-001` | ADR-050 fixed window | buildFrame | skip |
| M1-S6 | Five concurrent sessions each receive a distinct color from the palette | milestone-1-per-session-traces | `@driving_port @US-PM-001` | Prototype palette (v2 arch §4) | buildFrame | skip |
| M1-S7 | No active sessions yields an empty scope with a clear legend | milestone-1-per-session-traces | `@driving_port @US-PM-001` | US-PM-001 empty-state domain example 3 | buildFrame | skip |
| M2-S1 | A fresh tool call pulse flares brightest at arrival | milestone-2-pulses | `@driving_port @US-PM-001` | v2 arch Q1 pulse timing; ADR-049 | buildFrame, multiSessionStore.appendPulse | **active (red)** |
| M2-S2 | A mid-life pulse carries a decay factor proportional to its age | milestone-2-pulses | `@driving_port @US-PM-001` | pulseTiming.decayFactor; D7 seam | buildFrame | skip |
| M2-S3 | Pulse strength varies with event kind | milestone-2-pulses | `@driving_port @US-PM-001` | v2 arch Q1 (tool > subagent > lifecycle) | buildFrame | skip |
| M2-S4 | Multiple pulses coexist on a single session's trace | milestone-2-pulses | `@driving_port @US-PM-001` | v2 arch Q1 pulse log shape | buildFrame | skip |
| M2-S5 | A pulse older than 2.5 seconds is absent from the frame | milestone-2-pulses | `@driving_port @US-PM-001` | Pulse lifetime (2.5s) | buildFrame | skip |
| M2-S6 | The store trims pulses older than the retention cutoff | milestone-2-pulses | `@driving_port @US-PM-001` | ADR-049 retention = 5s | multiSessionStore.getPulses | skip |
| M2-S7 | A pulse references a session value from the same arrived history | milestone-2-pulses | `@driving_port @US-PM-001` | Honest-signal invariant (no fabrication) | buildFrame | skip |
| M2-S8 | A session with pulses but no arrived rate history produces pulses at baseline | milestone-2-pulses | `@driving_port @US-PM-001` | Honest-signal invariant + pulse independence | buildFrame | skip |
| M3-S1 | Default metric at first launch is Events per second | milestone-3-metric-toggle | `@driving_port @US-PM-001` | wave-decisions "Events/s default" (Phil, 2026-04-17) | buildFrame | **active (red)** |
| M3-S2 | Switching to Tokens per second re-projects with the tokens scale | milestone-3-metric-toggle | `@driving_port @US-PM-001` | ADR-049 per-metric buffers | buildFrame | skip |
| M3-S3 | Switching to Tool-calls per second re-projects with the tool-calls scale | milestone-3-metric-toggle | `@driving_port @US-PM-001` | ADR-049 per-metric buffers | buildFrame | skip |
| M3-S4 | Persistence buffer is reset at the metric-change boundary | milestone-3-metric-toggle | `@driving_port @US-PM-001` | v2 arch §3 Q3 invariant; ADR-048 | buildFrame | skip |
| M3-S5 | Toggling back to the original metric re-projects from its own history | milestone-3-metric-toggle | `@driving_port @US-PM-001` | Per-metric buffer independence (ADR-049) | buildFrame | skip |
| M3-S6 | A session with history for one metric but not another projects an empty trace after toggle | milestone-3-metric-toggle | `@driving_port @US-PM-001` | ADR-049 boundary case | buildFrame | skip |
| M3-S7 | Hover is cleared when the metric changes | milestone-3-metric-toggle | `@driving_port @US-PM-001` | v2 arch §4 Q3 hover contract | buildFrame, scopeHitTest | skip |
| M4-S1 | Hover near a trace snaps to that session's nearest value | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | v2 arch Q7 hover contract; ADR-010 amended | scopeHitTest | **active (red)** |
| M4-S2 | Hover snaps to the nearest of two overlapping traces | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Nearest-snap semantic (prototype) | scopeHitTest | skip |
| M4-S3 | Hover value comes from sampling the arrived history at the pointer's time | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Hover-consistency invariant | scopeHitTest | skip |
| M4-S4 | Hover beyond the snap threshold produces no selection | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | MAX_SNAP semantic | scopeHitTest | skip |
| M4-S5 | Hover outside the scope area produces no selection | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Pointer-bounds boundary | scopeHitTest | skip |
| M4-S6 | Hover with no active sessions produces no selection | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Empty-frame boundary | scopeHitTest | skip |
| M4-S7 | Hover at the right edge reports an age near zero | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Time-to-X edge case | scopeHitTest | skip |
| M4-S8 | Hover at the left edge reports an age near the window length | milestone-4-hover-tooltip | `@driving_port @US-PM-001` | Time-to-X edge case (window boundary) | scopeHitTest | skip |
| M5-S1 | Adding a session makes it appear on the scope in the next frame | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | v2 arch lifecycle; ADR-049 | multiSessionStore.addSession, buildFrame | **active (red)** |
| M5-S2 | Removing a session makes it disappear from the scope in the next frame | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | v2 arch lifecycle | multiSessionStore.removeSession, buildFrame | skip |
| M5-S3 | The legend reflects the latest arrived value for each session | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | Legend contract (prototype) | buildFrame | skip |
| M5-S4 | Ambient 60-second window excludes samples older than the window | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | ADR-050 fixed 60s window | buildFrame | skip |
| M5-S5 | Pulses older than their retention are absent from the store | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | ADR-049 retention | multiSessionStore.getPulses | skip |
| M5-S6 | Removing a session removes its associated rate buffers and pulses | milestone-5-session-lifecycle | `@driving_port @US-PM-001` | ADR-049 store-lifecycle contract | multiSessionStore.removeSession / getRateHistory / getPulses | skip |
| IC-S1 | A 5-second tick of hook arrivals derives an events-per-second sample | integration-checkpoints | `@driving_port @US-PM-001` | v2 arch Q1 derivation pipeline | hookProcessor.deriveEventsRate | **active (red)** |
| IC-S2 | An OTel api-request event derives a tokens-per-second sample | integration-checkpoints | `@driving_port @US-PM-001` | v2 arch Q1 derivation pipeline | hookProcessor.deriveTokensRate | skip |
| IC-S3 | Tool-call events within a 5-second tick derive a tool-calls-per-second sample | integration-checkpoints | `@driving_port @US-PM-001` | v2 arch Q1 derivation pipeline | hookProcessor.deriveToolCallsRate | skip |
| IC-S4 | A tool-use hook event emits a pulse at the event's timestamp | integration-checkpoints | `@driving_port @US-PM-001` | v2 arch Q1 pulse emission | hookProcessor.emitPulse | skip |
| IC-S5 | A lifecycle hook event emits a pulse with a smaller strength than a tool-use pulse | integration-checkpoints | `@driving_port @US-PM-001` | Pulse kind strength convention | hookProcessor.emitPulse | skip |
| IC-S6 | Appending rate samples preserves temporal order on read | integration-checkpoints | `@driving_port @US-PM-001` | ADR-049 buffer contract | multiSessionStore.appendRateSample / getRateHistory | skip |
| IC-S7 | Appending pulses preserves arrival order on read | integration-checkpoints | `@driving_port @US-PM-001` | ADR-049 pulse log contract | multiSessionStore.appendPulse / getPulses | skip |
| IC-S8 | Querying a non-existent session returns empty history and pulses | integration-checkpoints | `@driving_port @US-PM-001` | Store boundary | multiSessionStore.getRateHistory / getPulses | skip |
| IC-S9 | Subscribers are notified after appendRateSample | integration-checkpoints | `@driving_port @US-PM-001` | Store pub/sub contract | multiSessionStore.subscribe | skip |
| IC-S10 | Subscribers are notified after appendPulse | integration-checkpoints | `@driving_port @US-PM-001` | Store pub/sub contract | multiSessionStore.subscribe | skip |
| IC-S11 | Frame values never invent sub-interval spikes beyond bracketing arrived values | integration-checkpoints | `@driving_port @property @US-PM-001` | Honest-signal invariant (property) | buildFrame | skip |
| IC-S12 | Frame values never zero-fill between arrivals when the last arrived value is non-zero | integration-checkpoints | `@driving_port @property @US-PM-001` | Honest-signal invariant (property) | buildFrame | skip |
| IC-S13 | Rate-sample append then read preserves timestamp order | integration-checkpoints | `@driving_port @property @US-PM-001` | Store order invariant (property) | multiSessionStore.appendRateSample / getRateHistory | skip |
| IC-S14 | Window trim is consistent across reads | integration-checkpoints | `@driving_port @property @US-PM-001` | Idempotence invariant (property) | multiSessionStore.getRateHistory | skip |
| IC-S15 | Hit-test consistency between trace value and returned value | integration-checkpoints | `@driving_port @property @US-PM-001` | Hover-trace consistency invariant (property) | scopeHitTest, buildFrame | skip |
| IC-S16 | Pulse decay factor monotonically decreases with age | integration-checkpoints | `@driving_port @property @US-PM-001` | Pulse-timing invariant (property) | pulseTiming.decayFactor, buildFrame | skip |

**Total scenarios:** 56 (across 7 feature files)

---

## Category Distribution

| Category | Count | % | Target |
|---|---|---|---|
| Walking skeletons | 4 | 7% | 2-3 per feature (met for this anchor job) |
| Happy-path focused | 16 | 30% | n/a |
| Error / boundary | 22 | 41% | ≥ 40% |
| Property-shaped (`@property`) | 6 | 11% | where universal invariants exist |
| Integration/adapter | 10 | 19% | one per adapter path |

Error-path ratio by file:

| File | Happy / Skeleton | Error / Boundary | Ratio (err/total) |
|---|---|---|---|
| walking-skeleton | 4 | 0 | 0% (skeletons only; by design) |
| milestone-1-per-session-traces | 3 | 4 | 57% |
| milestone-2-pulses | 4 | 4 | 50% |
| milestone-3-metric-toggle | 3 | 4 | 57% |
| milestone-4-hover-tooltip | 3 | 5 | 63% |
| milestone-5-session-lifecycle | 3 | 3 | 50% |
| integration-checkpoints | 10 (10 checkpoints, some are boundary) | 6 (@property) | n/a — derivation+invariants |

Overall error/boundary ratio across focused scenarios (excluding walking skeletons): **22/50 = 44%**, meeting the ≥ 40% target.

---

## Driving Ports Covered

| Port | Scenarios Exercising It |
|---|---|
| `buildFrame(store, metric, now)` | WS-1/2/3/4, M1-S1..S7, M2-S1..S5, M2-S7, M2-S8, M3-S1..S7, M4-S1..S8 (via hit-test setup), M5-S1..S4, M5-S6, IC-S11, IC-S12, IC-S15, IC-S16 |
| `scopeHitTest(pointer, frame)` | WS-4, M3-S7, M4-S1..S8, IC-S15 |
| `multiSessionStore.addSession` | WS-1..4, M1-*, M2-*, M3-*, M4-*, M5-* |
| `multiSessionStore.removeSession` | M5-S2, M5-S6 |
| `multiSessionStore.appendRateSample` | WS-1/3/4, M1-*, M2-S7, M3-S2/3/5/6, M4-*, M5-*, IC-S6, IC-S9, IC-S11..15 |
| `multiSessionStore.appendPulse` | WS-2, M2-*, IC-S7, IC-S10 |
| `multiSessionStore.getRateHistory` | IC-S6, IC-S8, IC-S13, IC-S14, M5-S6 |
| `multiSessionStore.getPulses` | M2-S6, IC-S7, IC-S8, M5-S5, M5-S6 |
| `multiSessionStore.subscribe` | IC-S9, IC-S10 |
| `hookProcessor.deriveEventsRate` | IC-S1 |
| `hookProcessor.deriveTokensRate` | IC-S2 |
| `hookProcessor.deriveToolCallsRate` | IC-S3 |
| `hookProcessor.emitPulse` | IC-S4, IC-S5 |
| `pulseTiming.decayFactor` | IC-S16 (indirectly WS-2, M2-S2, M2-S4) |

---

## Activation Strategy

One scenario enabled at a time, per the one-at-a-time TDD discipline. Currently active (red) first scenarios, one per step-def file:

1. walking-skeleton.test.ts — all `describe.skip` (by original author design); DELIVER enables WS-1 first.
2. milestone-1-per-session-traces.test.ts — M1-S1 active (red).
3. milestone-2-pulses.test.ts — M2-S1 active (red).
4. milestone-3-metric-toggle.test.ts — M3-S1 active (red).
5. milestone-4-hover-tooltip.test.ts — M4-S1 active (red).
6. milestone-5-session-lifecycle.test.ts — M5-S1 active (red).
7. integration-checkpoints.test.ts — IC-S1 active (red).

Each active scenario fails with a `ReferenceError: <driving-port> is not defined`. This is the outer-loop red: the driving port has not yet been implemented. DELIVER's first unit-test inner loop implements the driving port; the outer red turns green; the crafter enables the next scenario.

Recommended DELIVER activation order is specified in `handoff-deliver.md`.
