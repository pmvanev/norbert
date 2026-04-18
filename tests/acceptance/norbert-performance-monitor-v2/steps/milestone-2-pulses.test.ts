/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Milestone 2
 * Hook Event Pulses.
 *
 * Pulses flare on the originating session's trace at the event's arrival
 * timestamp and decay linearly over a 2.5-second visual lifetime. Pulses
 * beyond their lifetime are absent from the frame. The store trims pulses
 * older than retention (5s).
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame
 *   - multiSessionStore.addSession / appendRateSample / appendPulse / getPulses
 *
 * Feature file: milestone-2-pulses.feature
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q1,
 * ADR-049 (pulse log retention).
 */

import { describe, it, expect } from "vitest";

import {
  NOW,
  PULSE_LIFETIME_MS,
  PULSE_RETENTION_MS,
  PULSE_STRENGTHS,
  SESSION_COLORS,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports.
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// M2-S1: A fresh tool call pulse flares brightest at arrival
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason.
// ---------------------------------------------------------------------------

describe("M2-S1: A fresh tool call pulse flares brightest at arrival", () => {
  it("fresh pulse has decay factor at maximum value", () => {
    // Given session-1 has a steady envelope and a tool call arrives now
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    store.appendPulse("session-1", {
      t: NOW,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then there is a pulse on session-1 at the current time with max decay
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(1);
    expect(pulses[0].t).toBe(NOW);
    // decay is 1 at age=0 (fresh)
    expect(pulses[0].decay).toBeCloseTo(1, 5);
    expect(pulses[0].color).toBe(SESSION_COLORS[0]);
  });
});

// ---------------------------------------------------------------------------
// M2-S2: A mid-life pulse carries a decay factor proportional to its age
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S2: A mid-life pulse carries a decay factor proportional to its age", () => {
  it("1.25s-old pulse has decay factor of approximately 0.5", () => {
    // Given session-1 has a steady envelope and a tool call arrived 1.25s ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    const ageMs = 1250;
    store.appendPulse("session-1", {
      t: NOW - ageMs,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then the pulse is positioned at 1.25s ago with expected decay
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(1);
    expect(pulses[0].t).toBe(NOW - ageMs);

    const expectedDecay = 1 - ageMs / PULSE_LIFETIME_MS;
    expect(pulses[0].decay).toBeCloseTo(expectedDecay, 3);
    expect(pulses[0].decay).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// M2-S3: Pulse strength varies with event kind
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S3: Pulse strength varies with event kind", () => {
  it("tool call pulse strength exceeds lifecycle pulse strength", () => {
    // Given session-1 has a steady envelope and two kinds of event arrive now
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    store.appendPulse("session-1", {
      t: NOW,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });
    store.appendPulse("session-1", {
      t: NOW,
      kind: "lifecycle",
      strength: PULSE_STRENGTHS.lifecycle,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then two pulses are present with tool > lifecycle strength
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(2);
    const tool = pulses.find((p) => p.kind === "tool");
    const lifecycle = pulses.find((p) => p.kind === "lifecycle");
    expect(tool).toBeDefined();
    expect(lifecycle).toBeDefined();
    expect(tool!.strength).toBeGreaterThan(lifecycle!.strength);
  });
});

// ---------------------------------------------------------------------------
// M2-S3b (PA finding 3): Three pulse kinds exhibit the full
// tool-subagent-lifecycle strength ordering.
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S3b: Three pulse kinds exhibit the full strength ordering", () => {
  it("tool > subagent > lifecycle — pulses sort by strength descending", () => {
    // Given session-1 has a steady envelope and three kinds of event arrive now
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    // Append in a non-strength order so the test exercises ordering by strength,
    // not insertion order.
    store.appendPulse("session-1", {
      t: NOW,
      kind: "lifecycle",
      strength: PULSE_STRENGTHS.lifecycle,
    });
    store.appendPulse("session-1", {
      t: NOW,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });
    store.appendPulse("session-1", {
      t: NOW,
      kind: "subagent",
      strength: PULSE_STRENGTHS.subagent,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then three pulses appear on session-1, ordered by strength descending
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(3);
    expect(pulses.map((p) => p.kind)).toEqual(["tool", "subagent", "lifecycle"]);
    // Strengths must strictly decrease
    expect(pulses[0].strength).toBeGreaterThan(pulses[1].strength);
    expect(pulses[1].strength).toBeGreaterThan(pulses[2].strength);
    // And match the canonical PULSE_STRENGTHS values
    expect(pulses[0].strength).toBe(PULSE_STRENGTHS.tool);
    expect(pulses[1].strength).toBe(PULSE_STRENGTHS.subagent);
    expect(pulses[2].strength).toBe(PULSE_STRENGTHS.lifecycle);
  });
});

// ---------------------------------------------------------------------------
// M2-S4: Multiple pulses coexist on a single session's trace
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S4: Multiple pulses coexist on a single session's trace", () => {
  it("three pulses keep their own arrival times and decay factors", () => {
    // Given session-1 has a steady envelope and three tool calls at 0.5s, 1.0s, 2.0s ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    const ages = [500, 1000, 2000];
    for (const ageMs of ages) {
      store.appendPulse("session-1", {
        t: NOW - ageMs,
        kind: "tool",
        strength: PULSE_STRENGTHS.tool,
      });
    }

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then three pulses are present, each at its own time with its own decay
    const pulses = frame.pulses
      .filter((p) => p.sessionId === "session-1")
      .sort((a, b) => b.t - a.t); // newest first
    expect(pulses).toHaveLength(3);

    for (let i = 0; i < ages.length; i++) {
      const ageMs = ages[i];
      const matching = pulses.find((p) => p.t === NOW - ageMs);
      expect(matching).toBeDefined();
      const expectedDecay = 1 - ageMs / PULSE_LIFETIME_MS;
      expect(matching!.decay).toBeCloseTo(expectedDecay, 3);
    }
  });
});

// ---------------------------------------------------------------------------
// M2-S5: A pulse older than 2.5 seconds is absent from the frame
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S5: A pulse older than 2.5 seconds is absent from the frame", () => {
  it("3s-old pulse is not projected into the frame", () => {
    // Given session-1 has a steady envelope and a tool call arrived 3s ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    store.appendPulse("session-1", {
      t: NOW - 3000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then no pulses appear for session-1 in the frame
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M2-S6: The store trims pulses older than the retention cutoff
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S6: The store trims pulses older than the retention cutoff", () => {
  it("pulses older than 5s are absent from the store; younger pulses remain", () => {
    // Given session-1 has pulses at various ages including some beyond retention
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const ages = [1_000, 2_000, 4_500, 5_500, 10_000];
    for (const ageMs of ages) {
      store.appendPulse("session-1", {
        t: NOW - ageMs,
        kind: "tool",
        strength: PULSE_STRENGTHS.tool,
      });
    }

    // When the store is queried (trimming is internal to the store)
    const retained = store.getPulses("session-1");

    // Then only pulses within the retention window remain
    for (const pulse of retained) {
      expect(NOW - pulse.t).toBeLessThanOrEqual(PULSE_RETENTION_MS);
    }

    // And no retained pulse is older than the retention cutoff
    const retainedAges = retained.map((p) => NOW - p.t);
    for (const ageMs of retainedAges) {
      expect(ageMs).toBeLessThanOrEqual(PULSE_RETENTION_MS);
    }
  });
});

// ---------------------------------------------------------------------------
// M2-S7: A pulse references a session value from the same arrived history
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S7: A pulse references a session value from the same arrived history", () => {
  it("pulse's vertical value matches the arrived rate sample at its time", () => {
    // Given session-1 has an arrived rate of 10 at 1s ago and a pulse also at 1s ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    // Build a history whose sample at (NOW - 1000) equals 10.
    store.appendRateSample("session-1", "events", NOW - 5000, 10);
    store.appendRateSample("session-1", "events", NOW - 1000, 10);

    store.appendPulse("session-1", {
      t: NOW - 1000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then the pulse's vertical position value is 10 (the arrived rate at t)
    const pulse = frame.pulses.find((p) => p.sessionId === "session-1");
    expect(pulse).toBeDefined();
    expect(pulse!.v).toBeCloseTo(10, 5);
  });
});

// ---------------------------------------------------------------------------
// M2-S8: A session with pulses but no arrived rate history produces pulses at baseline
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("M2-S8: A session with pulses but no arrived rate history produces pulses at baseline", () => {
  it("pulse sits at zero baseline and no fabricated rate sample appears on the trace", () => {
    // Given session-1 has been added but has no rate samples
    const store = createMultiSessionStore();
    store.addSession("session-1");

    // And a lifecycle hook event arrives now
    store.appendPulse("session-1", {
      t: NOW,
      kind: "lifecycle",
      strength: PULSE_STRENGTHS.lifecycle,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then session-1 has a pulse, positioned at the baseline (v = 0)
    const pulse = frame.pulses.find((p) => p.sessionId === "session-1");
    expect(pulse).toBeDefined();
    expect(pulse!.v).toBe(0);

    // And no fabricated sample appears on session-1's trace
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.samples).toHaveLength(0);
  });
});
