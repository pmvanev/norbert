# Performance Monitor v2 — Wave Decisions (DISTILL)

**Wave:** DISTILL (acceptance-designer)
**Designer:** Quinn (nw-acceptance-designer)
**Date:** 2026-04-17
**Status:** Complete — Triple Review Gate passed (PO ✔ / SA ✔ after rev 1 / PA ✔). Ready for DELIVER handoff.
**Feature:** `norbert-performance-monitor` v2 (phosphor-scope redesign)

---

## Top-level DISTILL Decisions

| # | Decision | Short rationale | Cross-ref |
|---|---|---|---|
| DD1 | Acceptance tests drive the pure-domain seam `buildFrame(store, metric, now)` + `scopeHitTest(pointer, frame)` | Matches DESIGN D7 / §Q7; allows honest-signal invariants to be expressed at the domain boundary without canvas/DPR coupling | `../design/wave-decisions.md` D7 |
| DD2 | Test framework: Vitest with `.feature` files as spec-documentation (no Cucumber runner) | Single runner, aligned with project stack; `.feature` files carry business-language Gherkin for stakeholder review; Vitest `describe`/`it` steps mirror the scenarios one-for-one | Repo convention |
| DD3 | Integration: tests import real internal modules (`multiSessionStore`, pure `domain/phosphor/*` helpers) at DELIVER time; no mocks for pure domain | Pure-domain seam is the load-bearing surface; mocking it would create testing theater | DESIGN D4 |
| DD4 | No canvas smoke test in DISTILL scope | DESIGN `jest-canvas-mock` declined by Phil, 2026-04-17; pure-domain tests carry the coverage weight | `../design/wave-decisions.md` Resolved Items |
| DD5 | One-at-a-time TDD via Vitest `describe.skip` / active `describe` | Enables the outside-in outer-loop red-green cadence; DELIVER enables one scenario at a time as each driving port lands | BDD methodology |
| DD6 | Acceptance test path: `tests/acceptance/norbert-performance-monitor-v2/` with step-def files under `steps/` and feature files at the milestone root | Keeps v1 PM tests untouched (hard replace PR policy, DESIGN D5); `-v2` suffix signals the in-flight rewrite until v1 is removed | DESIGN D5 |
| DD7 | Gherkin uses business language only: session, trace, pulse, flare, metric, scope, hover, afterglow | Zero technical jargon; step-def delegation to (future) production ports keeps business logic out of the test glue | Business-language mandate |
| DD8 | Post-review BLOCKER fix: M3-S4 (persistence-buffer reset) reframed as a frame-observable consequence through `buildFrame` alone; `ensurePersistenceBuffer` / `PersistenceBufferHandle` deleted from the acceptance surface | `ensurePersistenceBuffer` is a view-internal effect helper inside `PhosphorCanvasHost`, not a listed driving port in D7 / §Q7; identity-assertion on an internal handle is not a seam-level observation | SA review BLOCKER |
| DD9 | Post-review MAJOR fix: M3-S7 (hover clear on metric change) reframed through `buildFrame` + `scopeHitTest`; `onMetricChange` view-reducer declaration deleted from the acceptance surface | `onMetricChange` is a React view reducer, not a listed driving port; the user-observable consequence is that the same pointer position no longer hits a trace after the metric toggles | SA review MAJOR |

---

## Acceptance Test Surface

**Seam:** `buildFrame(store, metric, now) -> Frame` (pure) + `scopeHitTest(pointer, frame) -> HoverSelection | null` (pure).

**Driving adapter surface:** `multiSessionStore` public API (`addSession`, `removeSession`, `appendRateSample`, `appendPulse`, `getRateHistory`, `getPulses`, `getSessionIds`, `subscribe`).

**Derivation surface (integration checkpoints only):** `hookProcessor.deriveEventsRate`, `deriveTokensRate`, `deriveToolCallsRate`, `emitPulse`; `pulseTiming.decayFactor`.

No acceptance scenario reaches into view-internal state (canvas refs, persistence buffer handles, React reducers). These belong to DELIVER-wave unit tests.

---

## Deliverables

- `tests/acceptance/norbert-performance-monitor-v2/walking-skeleton.feature` + `steps/walking-skeleton.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/milestone-1-per-session-traces.feature` + `steps/milestone-1-per-session-traces.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/milestone-2-pulses.feature` + `steps/milestone-2-pulses.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/milestone-3-metric-toggle.feature` + `steps/milestone-3-metric-toggle.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/milestone-4-hover-tooltip.feature` + `steps/milestone-4-hover-tooltip.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/milestone-5-session-lifecycle.feature` + `steps/milestone-5-session-lifecycle.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/integration-checkpoints.feature` + `steps/integration-checkpoints.test.ts`
- `tests/acceptance/norbert-performance-monitor-v2/steps/fixtures.ts`
- `docs/feature/norbert-performance-monitor/distill/test-scenarios.md` (inventory, traceability, activation strategy)
- `docs/feature/norbert-performance-monitor/distill/walking-skeleton.md`
- `docs/feature/norbert-performance-monitor/distill/handoff-deliver.md`
- `docs/feature/norbert-performance-monitor/distill/acceptance-review.md`
- `docs/feature/norbert-performance-monitor/distill/wave-decisions.md` (this file)

Total scenarios: 56 across 7 feature files (4 walking skeletons + 36 focused milestone + 16 integration/property checkpoints). Error-path ratio across focused scenarios: 44% (target >= 40%).

---

## DELIVER-Wave Follow-Ups (Non-Blocking)

Captured during DISTILL review (PO + PA findings). None block DISTILL handoff; all are handed forward to DELIVER with a clear intent.

### PO F-1 — US-PM-007 behavioral coexistence covered by dependency-cruiser, not Gherkin

US-PM-007 (amended) requires the v2 PM to coexist behaviorally with adjacent views (Oscilloscope, Gauge Cluster, Session Status, Cost Ticker). The honest way to enforce this is the phosphor-domain purity boundary — `domain/phosphor/*` must not import from other plugins or view modules. This is a static-analysis invariant, not a runtime Gherkin scenario.

**DELIVER Phase K action:** add the dependency-cruiser rule (per DESIGN D9) forbidding `src/plugins/norbert-usage/domain/phosphor/**` from importing anything outside `src/plugins/norbert-usage/domain/`. Wire it into CI.

### PO F-3 — IC-S11..IC-S16 property-shape bodies to become `fc.assert(fc.property(...))`

Scenarios tagged `@property` (IC-S11 through IC-S16) currently express invariants in Gherkin and have single-example test bodies. At DELIVER time these should be rewritten to use `fast-check` generators and `fc.assert(fc.property(...))` so the invariants are actually exercised over an input space.

**DELIVER action:** add `fast-check` as a dev-dep; rewrite IC-S11..IC-S16 test bodies to use generators; keep the Gherkin unchanged (the `@property` tag already signals the implementation technique).

### PA finding 1 — Subscriber notification contract for `addSession` / `removeSession` is under-specified

IC-S9 and IC-S10 cover subscriber notification after `appendRateSample` / `appendPulse` but explicitly reset the subscriber counter in setup, leaving the post-setup `addSession` / `removeSession` notification behavior untested. Two plausible contracts:

- **(A)** `addSession` / `removeSession` notify subscribers (lifecycle events propagate through the same pub/sub).
- **(B)** Only sample/pulse appends notify; lifecycle changes are observed through `getSessionIds()`.

**DELIVER action:** pick a contract, document it in the `multiSessionStore` module doc and ADR-049, and add one IC scenario asserting the chosen behavior without a counter reset.

### PA finding 2 — `fast-check` dev-dep not yet in `package.json`

As above (PO F-3). DELIVER adds it at the same time as the property-test rewrites.

### PA finding 3 — `subagent` pulse kind has no full three-way-ordering scenario

M2 covers pulse kinds individually (tool, lifecycle) and the tool > lifecycle ordering, but no scenario emits all three kinds (tool, subagent, lifecycle) together and asserts the complete `tool > subagent > lifecycle` strength ordering in a single frame.

**DELIVER action:** add one scenario to the M2 feature file that appends one pulse of each of the three kinds at the same (or near-same) timestamp and asserts the frame's pulses sort by strength in the `tool > subagent > lifecycle` order.

---

## Review Gate Result

- **Review type:** triple-review (56 scenarios > 3, rigor profile `thorough`)
- **Reviewer model:** sonnet (per `.nwave/des-config.json`)
- **PO reviewer:** approved on cycle 0 (3 MINOR findings; all forwarded to DELIVER)
- **SA reviewer:** rejected on cycle 0 (1 BLOCKER M3-S4 + 1 MAJOR M3-S7) → revised → approved on cycle 1
- **PA reviewer:** approved on cycle 0 (3 MINOR findings; all forwarded to DELIVER)

---

## Revision Log

- **2026-04-17 (rev 1):** Addressed SA reviewer BLOCKER (M3-S4 buffer-identity assertion) by rerouting M3-S4 to a frame-observable consequence through `buildFrame`, and MAJOR (M3-S7 view-reducer seam) by rerouting to `buildFrame` + `scopeHitTest`. Corrected scenario count in `test-scenarios.md` from 54 to 56 (PO trivial F-2). Removed `ensurePersistenceBuffer`, `PersistenceBufferHandle`, and `onMetricChange` declarations from the acceptance test surface entirely.
