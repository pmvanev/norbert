/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Milestone 4
 * Hover Tooltip.
 *
 * Hovering over the scope snaps to the nearest trace within a vertical
 * distance threshold and produces a selection identifying the session, its
 * arrived value at the pointer's time, and the age of that value. Minimal
 * content, no drill-down.
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame
 *   - scopeHitTest(pointer, frame) -> HoverSelection | null
 *   - multiSessionStore.addSession / appendRateSample
 *
 * Feature file: milestone-4-hover-tooltip.feature
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q3 (hover
 * contract), amended ADR-010 (pure hit-test + React tooltip).
 */

import { describe, it, expect } from "vitest";

import {
  HOVER_SNAP_DISTANCE_PX,
  NOW,
  WINDOW_MS,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (resolved as DELIVER wave lands modules).
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { scopeHitTest } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeHitTest";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

const WIDTH = 1000;
const HEIGHT = 400;

function xForAgeMs(ageMs: number): number {
  return WIDTH * (1 - ageMs / WINDOW_MS);
}

// ---------------------------------------------------------------------------
// M4-S1: Hover near a trace snaps to that session's nearest value
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason.
// ---------------------------------------------------------------------------

describe("M4-S1: Hover near a trace snaps to that session's nearest value", () => {
  it("selects session-1 at 12 evt/s with an age near 2 seconds", () => {
    // Given two sessions: session-1 carries 12 evt/s at 2s ago; session-2 is quiet
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");
    const quiet = synthesizeArrivedHistory(12, () => 0.5);
    for (const s of quiet) store.appendRateSample("session-2", "events", s.t, s.v);

    const s1History = synthesizeArrivedHistory(12, () => 12);
    for (const s of s1History) store.appendRateSample("session-1", "events", s.t, s.v);
    // Explicit sample at exactly 2s ago — the scenario's anchor point.
    store.appendRateSample("session-1", "events", NOW - 2000, 12);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is at the trace's (x, y) for session-1 at 2s ago
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    const x = xForAgeMs(2000);
    // Target y on session-1's trace: yMax=15, value=12 -> near top of scope
    const yMax = frame.yMax;
    const y = HEIGHT - (12 / yMax) * HEIGHT;

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the selection identifies session-1 at value 12 with age near 2s
    expect(selection).not.toBeNull();
    expect(selection!.sessionId).toBe("session-1");
    expect(selection!.value).toBeCloseTo(12, 1);
    expect(selection!.ageMs).toBeGreaterThan(1500);
    expect(selection!.ageMs).toBeLessThan(2500);
  });
});

// ---------------------------------------------------------------------------
// M4-S2: Hover snaps to the nearest of two overlapping traces
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S2: Hover snaps to the nearest of two overlapping traces", () => {
  it("selects the trace whose vertical position is closer to the pointer", () => {
    // Given session-1 at 10 evt/s and session-2 at 8 evt/s at current time
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");
    const h1 = synthesizeArrivedHistory(12, () => 10);
    const h2 = synthesizeArrivedHistory(12, () => 8);
    for (const s of h1) store.appendRateSample("session-1", "events", s.t, s.v);
    for (const s of h2) store.appendRateSample("session-2", "events", s.t, s.v);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is slightly closer to session-1's trace y-position
    const yMax = frame.yMax; // 15 for events
    const y1 = HEIGHT - (10 / yMax) * HEIGHT;
    const y2 = HEIGHT - (8 / yMax) * HEIGHT;
    const y = y1 + (y2 - y1) * 0.3; // 30% of the way from y1 to y2 -- closer to y1
    const x = xForAgeMs(0); // current-time edge

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the selection identifies session-1, not session-2
    expect(selection).not.toBeNull();
    expect(selection!.sessionId).toBe("session-1");
    expect(selection!.sessionId).not.toBe("session-2");
  });
});

// ---------------------------------------------------------------------------
// M4-S3: Hover value comes from sampling the arrived history at the pointer's time
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S3: Hover value comes from sampling the arrived history at the pointer's time", () => {
  it("value is the bracketing arrived sample at the pointer's time (no interpolation) and matches the trace's projected value", () => {
    // Given session-1 has arrived samples at 5s intervals with distinct values
    const store = createMultiSessionStore();
    store.addSession("session-1");
    // Arrived: (NOW - 15_000, 4), (NOW - 10_000, 8), (NOW - 5_000, 12)
    store.appendRateSample("session-1", "events", NOW - 15_000, 4);
    store.appendRateSample("session-1", "events", NOW - 10_000, 8);
    store.appendRateSample("session-1", "events", NOW - 5_000, 12);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is between (NOW-10s, 8) and (NOW-5s, 12), at midpoint (NOW-7.5s)
    // Expected value at pointerTime under the scope's bracketing rule (last sample
    // at-or-before pointerTime) = 8. No interpolation — the trace is a step/line
    // over the arrived samples and the hover value must sit on the same
    // bracketed sample that projection uses.
    const pointerTime = NOW - 7500;
    const ageMs = NOW - pointerTime;
    const x = xForAgeMs(ageMs);
    const yMax = frame.yMax;
    // Place the pointer vertically near the bracketed value (8) so the hit-test
    // snaps to session-1; the exact y does not affect the reported value (the
    // reported value is a property of pointer's x-time, not y).
    const y = HEIGHT - (8 / yMax) * HEIGHT;

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the selection's value is the bracketed arrived value (not an interpolation)
    expect(selection).not.toBeNull();
    expect(selection!.sessionId).toBe("session-1");
    expect(selection!.value).toBeCloseTo(8, 5);

    // And the value matches the trace's bracketed value at the pointer's time —
    // the value of the latest sample at-or-before pointerTime from the trace the
    // projection emits. scopeHitTest and scopeProjection must agree.
    const trace = frame.traces.find((t) => t.sessionId === "session-1")!;
    const bracketed = trace.samples.reduce<{ t: number; v: number } | null>(
      (best, s) => {
        if (s.t > pointerTime) return best;
        if (best === null || s.t > best.t) return s;
        return best;
      },
      null,
    );
    expect(bracketed).not.toBeNull();
    expect(selection!.value).toBeCloseTo(bracketed!.v, 5);
  });
});

// ---------------------------------------------------------------------------
// M4-S4: Hover beyond the snap threshold produces no selection
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S4: Hover beyond the snap threshold produces no selection", () => {
  it("returns null when vertical distance exceeds the snap threshold", () => {
    // Given session-1's trace sits near the bottom (value 1 on yMax=15)
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 1);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is near the top of the scope (far above the trace)
    const x = xForAgeMs(0);
    const y = 5; // well above the trace; distance > HOVER_SNAP_DISTANCE_PX

    // Sanity: the trace y is much lower on screen
    const yMax = frame.yMax;
    const traceY = HEIGHT - (1 / yMax) * HEIGHT;
    expect(Math.abs(y - traceY)).toBeGreaterThan(HOVER_SNAP_DISTANCE_PX);

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the hover is absent
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M4-S5: Hover outside the scope area produces no selection
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S5: Hover outside the scope area produces no selection", () => {
  it("returns null for pointer coordinates outside the scope rectangle", () => {
    // Given session-1 has history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 5);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is outside the scope rectangle (negative x, or past right edge)
    const outsideLeft = scopeHitTest(
      { x: -10, y: HEIGHT / 2, width: WIDTH, height: HEIGHT },
      frame,
    );
    const outsideRight = scopeHitTest(
      { x: WIDTH + 10, y: HEIGHT / 2, width: WIDTH, height: HEIGHT },
      frame,
    );
    const outsideTop = scopeHitTest(
      { x: WIDTH / 2, y: -10, width: WIDTH, height: HEIGHT },
      frame,
    );
    const outsideBottom = scopeHitTest(
      { x: WIDTH / 2, y: HEIGHT + 10, width: WIDTH, height: HEIGHT },
      frame,
    );

    // Then the hover is absent in every case
    expect(outsideLeft).toBeNull();
    expect(outsideRight).toBeNull();
    expect(outsideTop).toBeNull();
    expect(outsideBottom).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M4-S6: Hover with no active sessions produces no selection
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S6: Hover with no active sessions produces no selection", () => {
  it("returns null when the frame has no traces", () => {
    // Given no sessions are active
    const store = createMultiSessionStore();
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces).toHaveLength(0);

    // When the pointer is inside the scope area
    const selection = scopeHitTest(
      { x: WIDTH / 2, y: HEIGHT / 2, width: WIDTH, height: HEIGHT },
      frame,
    );

    // Then the hover is absent
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M4-S7: Hover at the right edge reports an age near zero
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S7: Hover at the right edge reports an age near zero", () => {
  it("age is less than 0.5 seconds at the current-time edge of the scope", () => {
    // Given session-1 has a recent arrived sample at the current moment
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.appendRateSample("session-1", "events", NOW, 10);

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is at the right edge of the scope over session-1's trace
    const x = WIDTH - 1;
    const yMax = frame.yMax;
    const y = HEIGHT - (10 / yMax) * HEIGHT;

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the selection's age is less than 0.5 seconds
    expect(selection).not.toBeNull();
    expect(selection!.sessionId).toBe("session-1");
    expect(selection!.ageMs).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// M4-S8: Hover at the left edge reports an age near the window length
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M4-S8: Hover at the left edge reports an age near the window length", () => {
  it("age is approximately 60 seconds at the left edge of the scope", () => {
    // Given session-1 has arrived samples spanning the full 60s window
    const store = createMultiSessionStore();
    store.addSession("session-1");
    for (let ageS = 60; ageS >= 0; ageS -= 5) {
      store.appendRateSample("session-1", "events", NOW - ageS * 1000, 6);
    }

    const frame = buildFrame(store, "events", NOW);

    // When the pointer is at the left edge
    const x = 0;
    const yMax = frame.yMax;
    const y = HEIGHT - (6 / yMax) * HEIGHT;

    const selection = scopeHitTest({ x, y, width: WIDTH, height: HEIGHT }, frame);

    // Then the selection's age is approximately 60 seconds
    expect(selection).not.toBeNull();
    expect(selection!.ageMs).toBeGreaterThan(WINDOW_MS - 2000);
    expect(selection!.ageMs).toBeLessThanOrEqual(WINDOW_MS);
  });
});
