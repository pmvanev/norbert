/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Milestone 1
 * Per-Session Rate Envelope Traces.
 *
 * The scope renders one color trace per session, projected from that session's
 * EWMA-smoothed arrived rate history. Each trace preserves the session's color
 * identity. No sub-interval interpolation. No zero-fill between arrivals.
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame
 *   - multiSessionStore.addSession / appendRateSample / getRateHistory
 *
 * Feature file: milestone-1-per-session-traces.feature
 *
 * One scenario enabled at a time. First scenario of this file fails for a
 * business-logic reason (trace count mismatch), not a setup or import error.
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q1/Q4.
 */

import { describe, it, expect } from "vitest";

import {
  METRICS,
  NOW,
  SESSION_COLORS,
  WINDOW_MS,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (target modules — resolved by DELIVER wave).
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// M1-S1: Each active session gets its own color identity on the scope
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason so the
// DELIVER wave sees red on enabling it.
// ---------------------------------------------------------------------------

describe("M1-S1: Each active session gets its own color identity on the scope", () => {
  it("produces three traces with three distinct, stable session colors", () => {
    // Given three sessions are active with arrived rate history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");
    store.addSession("session-3");

    const historyA = synthesizeArrivedHistory(12, (i) => 3 + i * 0.5);
    const historyB = synthesizeArrivedHistory(12, (i) => 5 + i * 0.3);
    const historyC = synthesizeArrivedHistory(12, (i) => 7 - i * 0.2);
    for (const s of historyA) store.appendRateSample("session-1", "events", s.t, s.v);
    for (const s of historyB) store.appendRateSample("session-2", "events", s.t, s.v);
    for (const s of historyC) store.appendRateSample("session-3", "events", s.t, s.v);

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);
    const frameAgain = buildFrame(store, "events", NOW + 16); // ~1 frame later

    // Then three traces appear
    expect(frame.traces).toHaveLength(3);

    // And each trace's session color is distinct from the others
    const colors = frame.traces.map((t) => t.color);
    const distinctColors = new Set(colors);
    expect(distinctColors.size).toBe(3);

    // And colors remain stable across consecutive frames
    const firstColorsById = new Map(frame.traces.map((t) => [t.sessionId, t.color]));
    for (const trace of frameAgain.traces) {
      expect(trace.color).toBe(firstColorsById.get(trace.sessionId));
    }
  });
});

// ---------------------------------------------------------------------------
// M1-S2: A trace samples its session's arrived rate history across the window
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M1-S2: A trace samples its session's arrived rate history across the window", () => {
  it("trace values stay bracketed by neighboring arrived samples (no sub-interval spikes)", () => {
    // Given session-1 has arrived samples at 5s intervals across the 60s window
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, (i) => 4 + i); // 4..15, latest = 15 evt/s
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();

    // Then each trace value must be bounded by its two bracketing arrived samples
    const arrived = [...history].sort((a, b) => a.t - b.t);
    for (const sample of trace!.samples) {
      // Find bracketing arrived samples
      let left = arrived[0];
      let right = arrived[arrived.length - 1];
      for (let i = 0; i < arrived.length - 1; i++) {
        if (arrived[i].t <= sample.t && sample.t <= arrived[i + 1].t) {
          left = arrived[i];
          right = arrived[i + 1];
          break;
        }
      }
      const hi = Math.max(left.v, right.v);
      const lo = Math.min(left.v, right.v);
      expect(sample.v).toBeLessThanOrEqual(hi + 1e-9);
      expect(sample.v).toBeGreaterThanOrEqual(lo - 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// M1-S3: A stalled session shows a flatline from the last arrived value
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M1-S3: A stalled session shows a flatline from the last arrived value, not a drop to zero", () => {
  it("flatlines at the last arrived value of 8 up to the current-time edge", () => {
    // Given session-1 had an arrived rate of 8 evt/s 20s ago and nothing since
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.appendRateSample("session-1", "events", NOW - 20_000, 8);

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.samples.length).toBeGreaterThan(0);

    // Then the trace carries the value 8 at the current-time edge
    const latest = trace!.samples[trace!.samples.length - 1];
    expect(latest.v).toBeCloseTo(8, 5);

    // And no trace value is zero while the last arrived value is non-zero
    for (const sample of trace!.samples) {
      expect(sample.v).not.toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// M1-S4: A session with no arrived history yet produces an empty trace
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M1-S4: A session with no arrived history yet produces an empty trace", () => {
  it("trace carries no samples and legend shows placeholder latest value", () => {
    // Given session-1 has just been added with no rate samples
    const store = createMultiSessionStore();
    store.addSession("session-1");

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then session-1's trace carries no sample values
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.samples).toHaveLength(0);

    // And the legend shows session-1 with a placeholder latest value (null)
    const legendEntry = frame.legend.find((e) => e.sessionId === "session-1");
    expect(legendEntry).toBeDefined();
    expect(legendEntry!.latestValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M1-S5: Samples older than the 60-second window are excluded from the trace
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M1-S5: Samples older than the 60-second window are excluded from the trace", () => {
  it("no trace point uses a sample timestamped more than 60 seconds ago", () => {
    // Given session-1 has samples spanning the last 120 seconds
    const store = createMultiSessionStore();
    store.addSession("session-1");
    for (let ageS = 120; ageS >= 0; ageS -= 5) {
      store.appendRateSample("session-1", "events", NOW - ageS * 1000, 5);
    }

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();

    // Then no trace point is older than 60 seconds
    const windowStart = NOW - WINDOW_MS;
    for (const sample of trace!.samples) {
      expect(sample.t).toBeGreaterThanOrEqual(windowStart);
    }
  });
});

// ---------------------------------------------------------------------------
// M1-S6: Five concurrent sessions each receive a distinct color from the palette
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M1-S6: Five concurrent sessions each receive a distinct color from the palette", () => {
  it("assigns each of the five palette colors exactly once across five sessions", () => {
    // Given five sessions are active with history
    const store = createMultiSessionStore();
    const ids = ["session-1", "session-2", "session-3", "session-4", "session-5"];
    for (const id of ids) {
      store.addSession(id);
      const history = synthesizeArrivedHistory(12, (i) => 2 + i * 0.3);
      for (const s of history) store.appendRateSample(id, "events", s.t, s.v);
    }

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then five traces appear with five distinct palette colors
    expect(frame.traces).toHaveLength(5);
    const colors = frame.traces.map((t) => t.color);
    const distinct = new Set(colors);
    expect(distinct.size).toBe(5);
    for (const color of colors) {
      expect(SESSION_COLORS).toContain(color);
    }
  });
});

// ---------------------------------------------------------------------------
// M1-S7: No active sessions yields an empty scope with a clear legend
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M1-S7: No active sessions yields an empty scope with a clear legend", () => {
  it("frame contains zero traces and an empty legend; yMax reflects current metric", () => {
    // Given no sessions are active
    const store = createMultiSessionStore();

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then the frame is empty but the Y-axis still carries the metric scale
    expect(frame.traces).toHaveLength(0);
    expect(frame.legend).toHaveLength(0);
    expect(frame.yMax).toBe(METRICS.events.yMax);
    expect(frame.metric).toBe("events");
  });
});
