# DISTILL Wave — Acceptance Review (Performance Monitor v2 Phosphor Scope)

**Wave:** DISTILL (acceptance-designer)
**Date:** 2026-04-17
**Feature:** `norbert-performance-monitor` v2
**Self-review against:** hexagonal-boundary compliance, story traceability, scope discipline, business-language purity, walking-skeleton user-centricity, one-at-a-time TDD discipline.

This is a self-review by the acceptance-designer. The triple-review gate (separately scheduled by the main orchestrator) supersedes this document if it disagrees.

---

## Dimension 1 — Hexagonal Boundary Compliance

**Question:** Do Then-steps assert through driving ports only, never against internal component state?

The driving-port seam per `v2-phosphor-decisions.md` D7 and `v2-phosphor-architecture.md` §5.Q7 is:

- `buildFrame(store, metric, now): Frame` — pure projection.
- `scopeHitTest(pointer, frame): HoverSelection | null` — pure hit-test.
- `multiSessionStore` public surface (`addSession`, `removeSession`, `appendRateSample`, `appendPulse`, `getRateHistory`, `getPulses`, `getSessionIds`, `subscribe`).
- `hookProcessor` derivation helpers (`deriveEventsRate`, `deriveTokensRate`, `deriveToolCallsRate`, `emitPulse`).
- `pulseTiming.decayFactor` (pure domain helper; exercised by the IC-S16 property-shape scenario).

**Assertions audit:**

- All assertions in WS-1..4, M1-S1..S7, M2-S1..S8, M3-S1..S3, M3-S5..S6, M4-S1..S8, M5-S1..S6 are on `Frame` objects, `HoverSelection` objects, or `ReadonlyArray<RateSample>` / `ReadonlyArray<Pulse>` values returned by the store. No assertion touches React props, canvas pixel output, DPR values, rAF scheduling, `useRef` contents, `persistenceBuffer` object identity, or any internal tree node.
- IC-S1..S5 assert on `RateSample` / `Pulse` objects returned by `hookProcessor` derivation helpers — pure-function return values.
- IC-S6..S10 assert on `multiSessionStore` query returns and subscriber-callback invocation counts — the store's documented pub/sub contract.
- IC-S11..S16 property-shape scenarios assert on frame/selection invariants, no internal state.
- M3-S4 (persistence-buffer reset) asserts on frame-observable consequences only: the post-toggle `Frame.yMax` is the new metric's scale (not the prior metric's), the post-toggle session trace carries no samples from the prior metric's history, and no prior-metric sample value appears anywhere in the post-toggle frame. Seam: `buildFrame` alone. (Revised 2026-04-17 rev 1 per SA reviewer BLOCKER — earlier drafts modeled a view-internal `PersistenceBufferHandle` and asserted handle identity; that was removed.)
- M3-S7 (hover-clear-on-metric-change) asserts on the `scopeHitTest` return for the same pointer position against two frames: non-null against the Events per second frame, null against the Tokens per second frame (whose session-1 trace is empty). Seam: `buildFrame` + `scopeHitTest`. (Revised 2026-04-17 rev 1 per SA reviewer MAJOR — earlier drafts modeled a view-internal `onMetricChange` reducer; that was removed.)

**Result:** PASS. All Then-steps assert through driving ports — `buildFrame`, `scopeHitTest`, and the `multiSessionStore` / `hookProcessor` public surfaces from D7 / §Q7. No scenario reaches into view-internal state.

---

## Dimension 2 — Story Traceability

Every scenario in the in-scope set maps to US-PM-001 (amended per `../design/upstream-changes.md`), to a v2-design decision from `wave-decisions.md` / `v2-phosphor-architecture.md`, or to a documented invariant in `docs/research/performance-monitor-live-signal-patterns.md`. Per-scenario trace is in `test-scenarios.md` column "Trace."

Explicit traces that earn extra calling-out:

- **Walking skeletons WS-1..4:** US-PM-001 amended solution ("single canvas with N color traces ... event pulses flare ... metric segmented control ...").
- **M1-S3, IC-S12:** Research invariant "no zero-fill between arrivals when last arrived value is non-zero" and D10 (heartbeat.ts deprecation).
- **M1-S2, IC-S11:** Research invariant "no sub-interval spike interpolation" (bracketing-sample bound).
- **M1-S5, M5-S4:** ADR-050 fixed 60s window.
- **M2-S6, M5-S5:** ADR-049 pulse-log retention (5s).
- **M2-S3, IC-S5:** v2 arch Q1 pulse-kind strength convention (tool > subagent > lifecycle).
- **M3-S1:** wave-decisions "Events/s default" confirmed by Phil 2026-04-17.
- **M3-S4:** v2 arch §3 Q3 persistence-buffer reset invariant + ADR-048.
- **M4-\*, IC-S15:** v2 arch §5.Q7 hover contract + amended ADR-010 hover-tooltip architecture.
- **IC-S1..S3:** v2 arch Q1 derivation pipeline (5s rate tick + OTel deltas).
- **IC-S9/S10:** ADR-049 store pub/sub contract.

**Result:** PASS. No scenario is orphaned.

---

## Dimension 3 — Scope Discipline

`../design/upstream-changes.md` establishes the scope bound:

| Story | Disposition | Covered? |
|---|---|---|
| US-PM-001 | KEEP, amend | YES — WS-1..4, all M1..5 scenarios |
| US-PM-002 (aggregate) | SUPERSEDE | NOT covered (correctly) |
| US-PM-003 (drill-down) | OUT OF SCOPE | NOT covered (correctly) |
| US-PM-004 (time window) | SUPERSEDE | NOT covered (correctly) |
| US-PM-005 (context) | OUT OF SCOPE | NOT covered (correctly) |
| US-PM-006 (cost rate) | DE-SCOPED | NOT covered (correctly) |
| US-PM-007 | KEEP, one AC amended | See note below |

**Note on US-PM-007:** The amended AC in `upstream-changes.md` is: "PM phosphor rendering is implemented independently in `domain/phosphor/scopeProjection.ts`; the oscilloscope's `oscilloscope.ts` remains untouched." This is a codebase-structural assertion (does the PM import from oscilloscope.ts?) not a behavioral outcome a user experiences. It is better validated at DELIVER time by a `dependency-cruiser` boundary rule (per `wave-decisions.md` D9) or a static-analysis smoke test than by a Gherkin acceptance scenario. The DISTILL wave therefore does **not** author a user-facing scenario for this AC, and instead flags it as a DELIVER boundary-rule enforcement task. If the main orchestrator disagrees and wants a behavioral coexistence scenario, it would look like: "Given both the Oscilloscope view and the Performance Monitor view are registered, when a hook event arrives for the broadcast session, then both views update within 1 second and the oscilloscope's dual-trace waveform remains visible" — but this crosses the feature's hard scope boundary into the broader plugin's registration surface, which is not part of this DISTILL delta.

No scenarios for out-of-scope stories (US-PM-002..006) appear in the suite.

**Result:** PASS with one recommendation to DELIVER (add the `dependency-cruiser` rule forbidding `domain/phosphor/**` from importing `domain/oscilloscope.ts`, which enforces US-PM-007's amended AC structurally).

---

## Dimension 4 — Business Language Purity

Gherkin feature files use: session, trace, pulse, flare, metric, scope, hover, legend, persistence buffer, Y-axis, window, arrival, envelope, baseline, age, decay, strength, tick, snap, retention, lifecycle.

Step-def descriptions use the same vocabulary plus Vitest scaffolding words (`describe`, `it`, `expect`).

**Forbidden terms (checked — none present in feature files):** HTTP, API (in the general programming sense; "OTel api-request" in IC-S2 is a domain term from the upstream OTel event schema), JSON, SQL, database, React, render, component, state, hook (as a JS/React concept — "hook event" in the domain is a domain concept, not React), callback (present in IC-S9/S10 step-def only, inside the `it` description where the subscribe-callback contract is the thing being asserted; the feature file uses "subscriber is notified" which is business language), DOM, canvas (present only in architecture docs, not feature files), DPR, rAF.

One usage audit-tension to call out for future review: "subscriber callback" appears in step-def text (`it("subscriber callback is invoked exactly once", ...)`). The feature file text uses "the subscriber is notified exactly once" — business-language purity held at the Gherkin layer. The step-def is more technical because it is the executable implementation binding to `store.subscribe(() => ...)`. This split is consistent with the Three-Layer Abstraction Model (feature = business language; step = execution; production code = implementation detail).

**Result:** PASS at the feature-file layer. Step-def layer uses minimally-necessary technical terms (`expect`, `toBe`, `subscriber callback`, `store`) consistent with executable-specification conventions.

---

## Dimension 5 — Walking-Skeleton User-Centricity

`walking-skeleton.md` argues for four skeletons grounded in the anchor job. Each scenario name is phrased as a user goal, not a layer-traversal description:

- "User glances at the scope and sees two sessions alive and churning" — user goal
- "User sees a fresh hook event flare as a pulse on its session's trace" — user goal
- "User switches the metric and the scope re-projects with the new scale" — user goal
- "User hovers over a trace and a tooltip identifies the session, value, and age" — user goal

None of the four are phrased as "end-to-end order placement touches all layers"-style architecture-confirmation scenarios.

The skeleton count (4) is slightly above the 2-3 guidance, justified by the four distinct first-class behaviors of the view. See `walking-skeleton.md` §"Why Not Only One Skeleton?"

**Result:** PASS.

---

## Dimension 6 — One-at-a-Time TDD Discipline

Seven step-def files. One file (walking-skeleton.test.ts) pre-authored with all-`describe.skip` — DELIVER enables WS-1 first. The other six each have their first scenario in a plain `describe(...)` (active, failing red) and subsequent scenarios in `describe.skip(...)`. This produces 6 active failing scenarios, one per file, all failing with a `ReferenceError` naming a specific not-yet-implemented driving port. Each red scenario is for business-logic reasons (driving-port function does not exist), not for setup or import errors.

**Smoke test result (recorded in handoff-deliver.md):**
- 6 failures, each a `ReferenceError` on a distinct driving-port symbol.
- 50 skipped scenarios.
- 1 file with all scenarios pre-skipped (walking-skeleton.test.ts).
- 0 failures from fixture imports, type mismatches, or syntax errors.

DELIVER's one-at-a-time activation: fix the current red (implement the driving port), un-skip the next scenario, repeat. See `handoff-deliver.md` §Activation Order for the recommended sequence.

**Result:** PASS.

---

## Summary

| Dimension | Result | Evidence |
|---|---|---|
| Hexagonal boundary compliance | PASS | All Then-steps on Frame / HoverSelection / RateSample / Pulse returns; M3-S4 and M3-S7 abstracted so hover/persistence assertions remain pure. |
| Story traceability | PASS | Every in-scope scenario traces to US-PM-001 amended + a design decision. Out-of-scope stories not covered, correctly. |
| Scope discipline | PASS (with one DELIVER recommendation: dependency-cruiser rule for US-PM-007's structural AC). |
| Business-language purity | PASS at Gherkin layer; step-defs minimally technical per conventions. |
| Walking-skeleton user-centricity | PASS (4 user-goal-phrased skeletons; rationale in walking-skeleton.md). |
| One-at-a-time TDD discipline | PASS (6 active reds, 50 skipped, 0 fixture/import failures). |

**Overall:** approved for handoff to DELIVER (nw-functional-software-crafter). `handoff-deliver.md` carries the operational details.

This self-review does not replace the triple-review gate; the main-instance orchestrator owns that phase.
