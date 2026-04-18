# DISTILL Wave — Walking Skeleton (Performance Monitor v2 Phosphor Scope)

**Wave:** DISTILL (acceptance-designer)
**Date:** 2026-04-17
**Feature:** `norbert-performance-monitor` v2
**Anchor job:** ambient aliveness — "are my agents alive and churning?"

---

## What the Walking Skeleton Answers

A user-centric walking skeleton must answer: *can a user accomplish their goal?* — not just *do the layers connect?*

For v2 PM the goal, from `docs/discovery/performance-monitor-jobs.md`, is ambient peripheral-vision confirmation that the agents are alive. The walking skeleton scenarios are the minimum coherent slice that lets Phil glance at the PM, recognize aliveness (or its absence), register a fresh hook event as a visual flare, switch the metric to a different Y-axis scale, and hover for a `session · value · age` identification.

Four scenarios form the skeleton, all living in `tests/acceptance/norbert-performance-monitor-v2/walking-skeleton.feature` and `steps/walking-skeleton.test.ts`, each tagged `@walking_skeleton @driving_port @US-PM-001`:

1. **WS-1 — User glances at the scope and sees two sessions alive and churning.** The core rendering loop: two sessions each with arrived rate history project into two colored traces with legend entries. Covers: `multiSessionStore.addSession`, `appendRateSample`, `buildFrame(store, "events", now)`, session-color palette assignment, legend projection.
2. **WS-2 — User sees a fresh hook event flare as a pulse on its session's trace.** The pulse side of the aliveness loop: a tool-call arrival shows up as a time-decaying flare on the originating session's trace. Covers: `appendPulse`, `buildFrame` pulse projection, `pulseTiming.decayFactor`.
3. **WS-3 — User switches the metric and the scope re-projects with the new scale.** The metric-toggle loop: selecting Tokens/s re-projects with the tokens history and a yMax of 100. Covers: per-metric buffer separation (ADR-049), `phosphorMetricConfig` lookup, and by implication the persistence-buffer reset invariant at the boundary.
4. **WS-4 — User hovers over a trace and a tooltip identifies the session, value, and age.** The investigate-briefly loop: a pointer near a trace produces a `session · value · age` selection. Covers: `scopeHitTest` + the buildFrame→hit-test consistency contract.

Together these four scenarios close the ambient-aliveness business-value loop end-to-end through the Outside-In TDD seam (pure `buildFrame` + pure `scopeHitTest`), demonstrating all three driving-port surfaces that the feature depends on. If all four pass, Phil can glance at the PM, observe aliveness, see hook-event flares, switch metrics, and hover-for-identification — the whole anchor job.

---

## Why Not Only One Skeleton?

A single "two sessions and two traces" skeleton would cover the core loop for a static single-metric view. But three first-class behaviors lie outside that: pulse rendering (central to the v2 aesthetic; the prototype validates that pulse flares carry the aliveness signal between 5s OTel arrivals), metric toggle (the only runtime user control on the view), and hover (the only on-demand investigation affordance). Each is a distinct user goal within the anchor job and each exercises a distinct driving port. Collapsing them into one skeleton hides failure modes that would otherwise show up during DELIVER.

Four skeletons is the smallest set that demonstrates the feature's user value, consistent with the guidance "2-3 skeletons + 15-20 focused scenarios per feature" interpreted against a view whose value is four-behavior.

---

## Implementation Order for DELIVER

Walking skeletons drive the outer TDD loop. DELIVER activates them in this order (rationale in `handoff-deliver.md`):

1. **WS-1** — establishes the store, the rate-append path, the projection pipeline, the palette, and the legend. Most of the domain surface lands here.
2. **WS-2** — pulse append + pulse projection + pulse decay. Depends on the WS-1 scaffolding.
3. **WS-3** — metric switching + per-metric buffers. Depends on WS-1; adds the `phosphorMetricConfig` lookup path.
4. **WS-4** — hit-test. Depends on WS-1 for the frame shape.

Between skeletons, enable the focused-boundary scenarios that exercise the same surface (per-file M-series and IC-series) one at a time, in the order documented in `handoff-deliver.md` §Activation Order.

---

## What Counts as "Done" for the Skeleton

The skeleton is complete when all four walking-skeleton scenarios are enabled and passing against the real domain modules (`domain/phosphor/scopeProjection.ts`, `domain/phosphor/scopeHitTest.ts`, `domain/phosphor/pulseTiming.ts`, `domain/phosphor/phosphorMetricConfig.ts`, `domain/phosphor/ewma.ts`, `domain/phosphor/rateDerivation.ts`) and the real adapter (`adapters/multiSessionStore.ts`, v2 shape). Passing means Phil can build, run the plugin, open the Performance Monitor, and see live per-session traces with pulses, toggle metrics, and hover. Skeleton pass is also the earliest checkpoint where the honest-signal invariants (no sub-interval spike, no zero-fill) are observable end-to-end through the pure seam.
