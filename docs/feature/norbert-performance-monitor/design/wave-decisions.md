# Performance Monitor v2 — Wave Decisions (DESIGN)

**Wave:** DESIGN
**Mode:** propose
**Architect:** Morgan (nw-solution-architect)
**Date:** 2026-04-17
**Status:** Complete — handoff to DISTILL (acceptance-designer).

---

## Key Decisions

| # | Decision | Short rationale | Details |
|---|---|---|---|
| D1 | Replace v1 per-category (4) buffers with per-metric (3) rate buffers + per-session pulse log | Matches prototype 1:1; resolves `CategorySample` semantic TODO; drops unused aggregation machinery | Q1 in architecture doc; ADR-049 |
| D2 | Collapse 7 v1 PM view components into 5 phosphor components under `views/phosphor/` | Prototype is a single canvas + controls + legend + tooltip; master/detail shell no longer serves any job | Q2; ADR-048 |
| D3 | Canvas + offscreen persistence buffer in refs inside `PhosphorCanvasHost`; discard-and-recreate on metric toggle | Honest render (no cross-scale crossfade); matches prototype; avoids React re-renders on hot path | Q3; ADR-048 |
| D4 | Pure `domain/phosphor/*` modules; effects confined to `PhosphorCanvasHost`, `multiSessionStore`, `hookProcessor` | Enforces functional paradigm (ADR-004); enables mutation-testing on all derivation | Q4 |
| D5 | Hard replace in a single PR (no feature flag) | Sole-user context; plan-of-record mandates clean replace; view ID preserved | Q5 |
| D6 | Leave oscilloscope and gauge cluster untouched | Out of scope per plan-of-record decision #4 | Q6 |
| D7 | Outside-In TDD seam: pure `buildFrame(store, metric, now)` + `scopeHitTest(mouseXY, frame)` | Seam-based acceptance tests; no pixel-diffing; canvas smoke test only for draw-pipeline sanity | Q7 |
| D8 | Fix time window at 60s; delete multi-window selector | Ambient-glance job; historical analysis delegated; memory drops ~25× | ADR-050 |
| D9 | Recommend `dependency-cruiser` rule to enforce phosphor-domain purity | Boundary rules without enforcement erode | Architecture doc §7 |
| D10 | Deprecate `heartbeat.ts` — 60fps render provides continuous motion from data alone | Research finding: zero-fill is an anti-pattern; fabricated data undermines honesty invariants | Q4 |

---

## Architecture Summary

**Single registered view** (`performance-monitor`, ID unchanged) renders `PhosphorScopeView`. The view:

1. Subscribes to `multiSessionStore` for session lifecycle.
2. Holds `selectedMetric: "events" | "tokens" | "toolcalls"` as local React state.
3. Delegates canvas rendering to `PhosphorCanvasHost`, which owns a canvas element + offscreen persistence buffer in refs, runs a `requestAnimationFrame` loop, and handles pointer events.
4. Emits hover selections to `PhosphorHoverTooltip` (React DOM; minimal `name · value · age` content).
5. Renders `PhosphorLegend` showing per-session color + latest value.

**Data pipeline** (upstream → downstream):

```
Claude Code -> Axum hook receiver -> React event bus
  -> hookProcessor.ts (amended)
       - derives events/s, tokens/s, toolcalls/s per session
       - emits pulse events for hook tool/subagent/lifecycle arrivals
  -> multiSessionStore.ts (amended)
       - per-session, per-metric rate buffers (60s window, ~30 entries at 5s rate)
       - per-session pulse log (2.5s visual lifetime, 5s retention)
       - public: addSession, updateSession, appendRateSample, appendPulse,
                 getSessions, getRateHistory(sid, metric), getPulses(sid),
                 subscribe, removeSession
  -> PhosphorCanvasHost (effect component, rAF loop)
       - pure domain/phosphor/* functions for projection, hit-test, ewma, pulse decay
       - draws offscreen persistence buffer -> composites to visible canvas
```

**C4 Context, Container, Component diagrams** in `v2-phosphor-architecture.md` (Mermaid).

---

## Technology Stack (carryover, no changes)

| Layer | Tech | Status |
|---|---|---|
| Desktop shell | Tauri 2.0 | Unchanged |
| Backend | Rust (modular monolith, ports-and-adapters) | Unchanged |
| Frontend | React + TypeScript + Vite | Unchanged |
| Storage | SQLite (WAL) | Unchanged |
| Hook receiver | Axum | Unchanged |
| Charting (v2 PM) | HTML Canvas 2D API (native) | No new dependency |
| Boundary enforcement (new recommendation) | `dependency-cruiser` (MIT, active, widely adopted) | **NEW** — add dev-dep and CI rule |
| Test runner | Vitest | Unchanged |
| Mutation testing | Stryker (per `CLAUDE.md` per-feature policy) | Unchanged |
| Canvas mocking in tests | (none — skipped) | **Declined** — pure-domain tests carry the coverage; canvas smoke test omitted |

No new runtime dependencies. One new dev-dep accepted: `dependency-cruiser` (MIT, mature) for enforcing pure-domain boundary rules at CI. `jest-canvas-mock` declined per user — the pure-domain tests cover the load-bearing logic; the canvas draw-pipeline smoke test is omitted. Documented rationale in the architecture doc §7 and §Q7.

---

## Constraints Established

1. **Functional paradigm enforced** — pure modules under `domain/phosphor/` forbidden from importing React, adapters, views, or effect globals. Boundary rule in CI via `dependency-cruiser`.
2. **Honest-signal invariants** — no sub-interval interpolation (no spikes between 5s OTel arrivals); no zero-fill between arrivals; motion comes from 60fps render scroll plus EWMA smoothing of *arrived* samples.
3. **Persistence buffer reset invariant** — buffer invalidated and recreated on change of `{canvas width, canvas height, selected metric, DPR}`; enforced by a single `ensurePersistenceBuffer` helper.
4. **View ID preserved** — `performance-monitor` view ID unchanged; existing window layouts resolve to the new component transparently.
5. **Adjacent views untouched** — Oscilloscope, Gauge Cluster, Session Status, Cost Ticker unchanged; v2 is a view-local rewrite.
6. **Per-feature mutation testing** — mutation targets scoped to `domain/phosphor/*`, the new pathways in `multiSessionStore.ts`, and the new derivation helpers in `hookProcessor.ts`. ≤20% survival threshold for pure domain; ≤30% for adapter.
7. **No new external integrations** — no new contract-test annotations for platform-architect.

---

## Upstream Changes

See `upstream-changes.md` for the full story-by-story disposition. Summary:

- **US-PM-001** kept with amended content.
- **US-PM-002, US-PM-004** superseded.
- **US-PM-003, US-PM-005** out of scope (delegated).
- **US-PM-006** de-scoped, but architecture is designed to accept cost as a future fourth metric-toggle entry.
- **US-PM-007** kept with one AC amendment.

ADR delta: `v2-adr-delta.md`.

---

## Resolved Items

None of the seven open architecture questions required user decision — all were resolvable from the plan-of-record, the prototype, and the research. Two soft calls surfaced and resolved during DESIGN handoff:

1. **Default metric at first launch** → **Events/s** (confirmed by Phil, 2026-04-17). Widest dynamic range, stays non-zero from lifecycle hooks between OTel arrivals, best at conveying "alive." Overridable via the segmented control; first-launch default only.
2. **New dev-deps** → **`dependency-cruiser` accepted; `jest-canvas-mock` declined** (confirmed by Phil, 2026-04-17). The boundary-enforcement value of `dependency-cruiser` is load-bearing for paradigm integrity; the canvas smoke test `jest-canvas-mock` would have enabled is marginal given pure-domain tests carry the weight. Architecture doc §7 / §Q7 treatments should be read with this resolution in mind.

---

## Handoff-Ready Checklist

- [x] Requirements (anchor job, seven architecture questions) traced to components
- [x] Component boundaries with clear responsibilities
- [x] Technology choices: no new runtime deps; two dev-deps proposed with alternatives
- [x] Quality attributes addressed: performance, maintainability, reliability, testability
- [x] Dependency inversion: pure domain + effect boundaries at adapters and canvas host
- [x] C4 diagrams: Context, Container, Component (Mermaid)
- [x] Integration patterns: unchanged upstream; intra-plugin store + pub/sub
- [x] OSS preference validated: Canvas API native, both dev-deps MIT
- [x] Acceptance criteria behavioral (view-logic seam + hover contract), not implementation-coupled
- [x] External integrations annotated: none new
- [x] Enforcement tooling recommended: `dependency-cruiser` (language-appropriate)
- [ ] Peer review (not invoked in this propose-mode run by default; reviewer subagent available on request)

---

## Deliverables (file paths)

- `docs/feature/norbert-performance-monitor/design/v2-phosphor-architecture.md`
- `docs/feature/norbert-performance-monitor/design/v2-adr-delta.md`
- `docs/feature/norbert-performance-monitor/design/upstream-changes.md`
- `docs/feature/norbert-performance-monitor/design/wave-decisions.md` (this file)

No update to `docs/architecture.md`: the v2 PM change is a view-and-adapter delta within an existing plugin, not a top-level system architecture change. Tech stack row is unchanged; modular-monolith + ports-and-adapters posture is unchanged.

New ADRs to author during DELIVER (text sketched in the ADR delta): **ADR-048**, **ADR-049**, **ADR-050**.
