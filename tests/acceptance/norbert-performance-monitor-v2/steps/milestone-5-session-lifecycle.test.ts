/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Milestone 5
 * Session Lifecycle and Ambient Window.
 *
 * Sessions are added and removed from the store as Claude Code sessions start
 * and end. The scope reflects lifecycle changes in the next projected frame.
 * The 60-second ambient window trims samples and pulses older than the window
 * so the scope always shows only the recent past.
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame
 *   - multiSessionStore.addSession / removeSession / appendRateSample /
 *     appendPulse / getRateHistory / getPulses / getSessionIds
 *
 * Feature file: milestone-5-session-lifecycle.feature
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q1,
 * ADR-049 (per-session buffers + pulse retention), ADR-050 (fixed 60s window).
 */

import { describe, it, expect } from "vitest";

import {
  NOW,
  PULSE_RETENTION_MS,
  PULSE_STRENGTHS,
  WINDOW_MS,
  type Frame,
  type MetricId,
  type MultiSessionStoreSurface,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (resolved as DELIVER wave lands modules).
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// M5-S1: Adding a session makes it appear on the scope in the next frame
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason.
// ---------------------------------------------------------------------------

describe("M5-S1: Adding a session makes it appear on the scope in the next frame", () => {
  it("second trace appears after addSession is called", () => {
    // Given one session is active with history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const h1 = synthesizeArrivedHistory(12, () => 5);
    for (const s of h1) store.appendRateSample("session-1", "events", s.t, s.v);

    const firstFrame = buildFrame(store, "events", NOW);
    expect(firstFrame.traces).toHaveLength(1);

    // When a second session is added
    store.addSession("session-2");
    const h2 = synthesizeArrivedHistory(12, () => 7);
    for (const s of h2) store.appendRateSample("session-2", "events", s.t, s.v);

    const nextFrame = buildFrame(store, "events", NOW);

    // Then the next frame contains two traces and the legend lists both
    expect(nextFrame.traces).toHaveLength(2);
    const sessionIds = nextFrame.traces.map((t) => t.sessionId).sort();
    expect(sessionIds).toEqual(["session-1", "session-2"]);
    expect(nextFrame.legend.map((e) => e.sessionId).sort()).toEqual([
      "session-1",
      "session-2",
    ]);
  });
});

// ---------------------------------------------------------------------------
// M5-S2: Removing a session makes it disappear from the scope in the next frame
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M5-S2: Removing a session makes it disappear from the scope in the next frame", () => {
  it("middle session disappears from frame and legend after removeSession", () => {
    // Given three sessions are active with history
    const store = createMultiSessionStore();
    const ids = ["session-1", "session-2", "session-3"];
    for (const id of ids) {
      store.addSession(id);
      const h = synthesizeArrivedHistory(12, () => 5);
      for (const s of h) store.appendRateSample(id, "events", s.t, s.v);
    }

    // When the middle session is removed
    store.removeSession("session-2");
    const nextFrame = buildFrame(store, "events", NOW);

    // Then the frame contains two traces and session-2 is absent from the legend
    expect(nextFrame.traces).toHaveLength(2);
    const remainingIds = nextFrame.traces.map((t) => t.sessionId).sort();
    expect(remainingIds).toEqual(["session-1", "session-3"]);
    const legendIds = nextFrame.legend.map((e) => e.sessionId);
    expect(legendIds).not.toContain("session-2");
  });
});

// ---------------------------------------------------------------------------
// M5-S3: The legend reflects the latest arrived value for each session
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M5-S3: The legend reflects the latest arrived value for each session", () => {
  it("legend entries carry the most recent arrived value per session", () => {
    // Given session-1 most recently arrived 7 evt/s and session-2 most recently arrived 22 evt/s
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");
    // Build histories that end at 7 and 22 respectively.
    const h1 = synthesizeArrivedHistory(12, (i) => (i === 11 ? 7 : 3 + i * 0.1));
    const h2 = synthesizeArrivedHistory(12, (i) => (i === 11 ? 22 : 15 + i * 0.2));
    for (const s of h1) store.appendRateSample("session-1", "events", s.t, s.v);
    for (const s of h2) store.appendRateSample("session-2", "events", s.t, s.v);

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then the legend carries the latest values
    const l1 = frame.legend.find((e) => e.sessionId === "session-1");
    const l2 = frame.legend.find((e) => e.sessionId === "session-2");
    expect(l1?.latestValue).toBeCloseTo(7, 5);
    expect(l2?.latestValue).toBeCloseTo(22, 5);
  });
});

// ---------------------------------------------------------------------------
// M5-S4: Ambient 60-second window excludes samples older than the window
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M5-S4: Ambient 60-second window excludes samples older than the window", () => {
  it("samples at 70s and 90s ago are not projected; 30s and 45s remain", () => {
    // Given session-1 has samples at 30, 45, 70, and 90 seconds ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const ages = [30, 45, 70, 90];
    for (const ageS of ages) {
      store.appendRateSample("session-1", "events", NOW - ageS * 1000, 4);
    }

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();

    // Then no trace sample is older than 60 seconds
    const windowStart = NOW - WINDOW_MS;
    for (const sample of trace!.samples) {
      expect(sample.t).toBeGreaterThanOrEqual(windowStart);
    }
  });
});

// ---------------------------------------------------------------------------
// M5-S5: Pulses older than their retention are absent from the store
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M5-S5: Pulses older than their retention are absent from the store", () => {
  it("6s-old pulse is not retained; pulses within 5s remain", () => {
    // Given session-1 had a tool-call pulse 6 seconds ago and a recent one 2s ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.appendPulse("session-1", {
      t: NOW - 6000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });
    store.appendPulse("session-1", {
      t: NOW - 2000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When the store is queried
    const pulses = store.getPulses("session-1");

    // Then the 6s-old pulse is absent; the 2s-old pulse remains
    const stalePulse = pulses.find((p) => p.t === NOW - 6000);
    const recentPulse = pulses.find((p) => p.t === NOW - 2000);
    expect(stalePulse).toBeUndefined();
    expect(recentPulse).toBeDefined();

    // And all retained pulses are within the retention window
    for (const pulse of pulses) {
      expect(NOW - pulse.t).toBeLessThanOrEqual(PULSE_RETENTION_MS);
    }
  });
});

// ---------------------------------------------------------------------------
// M5-S6: Removing a session removes its associated rate buffers and pulses
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M5-S6: Removing a session removes its associated rate buffers and pulses", () => {
  it("store holds no history or pulses for the removed session", () => {
    // Given session-1 has arrived rate history and pulses
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const h = synthesizeArrivedHistory(12, () => 5);
    for (const s of h) store.appendRateSample("session-1", "events", s.t, s.v);
    store.appendPulse("session-1", {
      t: NOW - 1000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When session-1 is removed
    store.removeSession("session-1");

    // Then no rate buffers or pulses remain for session-1
    expect(store.getRateHistory("session-1", "events")).toHaveLength(0);
    expect(store.getPulses("session-1")).toHaveLength(0);

    // And subsequent frames do not project session-1
    const nextFrame = buildFrame(store, "events", NOW);
    const trace = nextFrame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeUndefined();
    const legendEntry = nextFrame.legend.find((e) => e.sessionId === "session-1");
    expect(legendEntry).toBeUndefined();
  });
});
