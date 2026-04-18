/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Walking Skeletons
 *
 * End-to-end walking skeletons for the ambient-aliveness anchor job:
 *   - Two sessions alive and churning produce two colored traces.
 *   - A hook event flare appears as a pulse on its session's trace.
 *   - Metric toggle re-projects at the new scale with persistence-buffer reset.
 *   - Hover snaps to a trace and identifies session, value, age.
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame
 *   - scopeHitTest(pointer, frame) -> HoverSelection | null
 *   - multiSessionStore.appendRateSample / appendPulse / getRateHistory / getPulses
 *
 * All tests start skipped. Enable one at a time, implement, commit, repeat.
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md D7, anchor job.
 */

import { describe, it, expect } from "vitest";

import {
  METRICS,
  NOW,
  PULSE_LIFETIME_MS,
  SESSION_COLORS,
  WINDOW_MS,
  type Frame,
  type HoverSelection,
  type MultiSessionStoreSurface,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (target modules — resolved once DELIVER implements them).
// Uncomment as each module lands.
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
// import { scopeHitTest } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeHitTest";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// Placeholder declarations so this file parses before DELIVER lands.
declare const scopeHitTest: (
  pointer: { x: number; y: number; width: number; height: number },
  frame: Frame,
) => HoverSelection | null;

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-1: Two sessions alive and churning
// Tag: @walking_skeleton @driving_port
// ---------------------------------------------------------------------------

describe("WS-1: User glances at the scope and sees two sessions alive and churning", () => {
  it("projects one colored trace per active session with legend values", () => {
    // Given two sessions are active with events-per-second history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");

    const historyA = synthesizeArrivedHistory(12, (i) => 3 + i * 0.5); // oldest -> newest
    const historyB = synthesizeArrivedHistory(12, (i) => 8 - i * 0.2);
    for (const s of historyA) store.appendRateSample("session-1", "events", s.t, s.v);
    for (const s of historyB) store.appendRateSample("session-2", "events", s.t, s.v);

    // When the scope projects a frame
    const frame = buildFrame(store, "events", NOW);

    // Then the frame contains one trace per active session, colored by identity
    expect(frame.traces).toHaveLength(2);
    expect(frame.traces.map((t) => t.sessionId).sort()).toEqual(["session-1", "session-2"]);
    expect(frame.traces[0].color).toBe(SESSION_COLORS[0]);
    expect(frame.traces[1].color).toBe(SESSION_COLORS[1]);
    expect(frame.traces[0].color).not.toBe(frame.traces[1].color);

    // And each trace carries sample values from arrived history
    expect(frame.traces[0].samples.length).toBeGreaterThan(0);
    expect(frame.traces[1].samples.length).toBeGreaterThan(0);

    // And the legend lists each session with latest arrived value
    expect(frame.legend).toHaveLength(2);
    const legend1 = frame.legend.find((e) => e.sessionId === "session-1");
    const legend2 = frame.legend.find((e) => e.sessionId === "session-2");
    expect(legend1?.latestValue).toBeCloseTo(historyA[historyA.length - 1].v, 5);
    expect(legend2?.latestValue).toBeCloseTo(historyB[historyB.length - 1].v, 5);
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-2: Hook event flare appears as a decaying pulse
// Tag: @walking_skeleton @driving_port
// ---------------------------------------------------------------------------

describe("WS-2: User sees a fresh hook event flare as a pulse on its session's trace", () => {
  it("projects a pulse entry with age-based decay factor at the event's arrival time", () => {
    // Given a session with a steady events-per-second envelope
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, () => 6);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    // And a tool-call hook event arrived 1.2 seconds ago
    const pulseAgeMs = 1200;
    store.appendPulse("session-1", {
      t: NOW - pulseAgeMs,
      kind: "tool",
      strength: 1.0,
    });

    // When the scope projects the current frame
    const frame = buildFrame(store, "events", NOW);

    // Then the frame contains a pulse entry on session-1's trace
    const pulsesForS1 = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulsesForS1).toHaveLength(1);
    const pulse = pulsesForS1[0];

    // And the pulse is positioned at the event's arrival time
    expect(pulse.t).toBe(NOW - pulseAgeMs);

    // And the pulse's decay factor reflects 1.2/2.5 of its lifetime consumed
    const expectedDecay = 1 - pulseAgeMs / PULSE_LIFETIME_MS;
    expect(pulse.decay).toBeCloseTo(expectedDecay, 3);

    // And the pulse carries session-1's color
    expect(pulse.color).toBe(SESSION_COLORS[0]);
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-3: Metric toggle re-projects with new scale
// Tag: @walking_skeleton @driving_port
// ---------------------------------------------------------------------------

describe("WS-3: User switches the metric and the scope re-projects with the new scale", () => {
  it("the next frame uses tokens-per-second history and Y-axis maximum of 100", () => {
    // Given session-1 has tokens-per-second history peaking near 80
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const tokenHistory = synthesizeArrivedHistory(12, (i) => 30 + i * 4); // peaks ~74
    for (const s of tokenHistory) store.appendRateSample("session-1", "tokens", s.t, s.v);

    // And events history is also populated (so the first frame on events has content)
    const eventHistory = synthesizeArrivedHistory(12, () => 5);
    for (const s of eventHistory) store.appendRateSample("session-1", "events", s.t, s.v);

    // When the user selects Tokens per second (next frame projection uses it)
    const frame = buildFrame(store, "tokens", NOW);

    // Then the frame uses tokens-per-second history and the tokens Y-axis maximum
    expect(frame.metric).toBe("tokens");
    expect(frame.yMax).toBe(METRICS.tokens.yMax);
    expect(frame.unit).toBe(METRICS.tokens.unit);

    // And session-1's trace samples come from the tokens history
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace?.samples[trace.samples.length - 1].v).toBeCloseTo(
      tokenHistory[tokenHistory.length - 1].v,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-4: Hover produces a tooltip-ready selection
// Tag: @walking_skeleton @driving_port
// ---------------------------------------------------------------------------

describe.skip("WS-4: User hovers over a trace and a tooltip identifies the session, value, and age", () => {
  it("hit-test returns session-2, value 47, age near 1.5 seconds", () => {
    // Given session-2 has an arrived value of 47 events per second at 1.5 seconds ago
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.addSession("session-2");
    const quietHistory = synthesizeArrivedHistory(12, () => 1);
    for (const s of quietHistory) store.appendRateSample("session-1", "events", s.t, s.v);

    const focusedHistoryS2 = synthesizeArrivedHistory(12, () => 47);
    for (const s of focusedHistoryS2) store.appendRateSample("session-2", "events", s.t, s.v);

    const frame = buildFrame(store, "events", NOW);

    // And the pointer is positioned over session-2's trace at 1.5 seconds ago
    const width = 1000;
    const height = 400;
    const windowFraction = 1 - 1500 / WINDOW_MS; // x = w * (1 - ageMs/windowMs)
    const x = width * windowFraction;
    // Vertical position for value 47 on the events yMax=15 scale would be above
    // the chart; to avoid scale-clipping in this skeleton we target session-2's
    // trace line directly using its frame-reported sample value.
    const traceS2 = frame.traces.find((t) => t.sessionId === "session-2");
    expect(traceS2).toBeDefined();
    // Use the nearest sample's trace position — the hit-test must find it within snap.
    // For the skeleton we simulate a pointer sitting at half-height; the hit-test
    // logic snaps to whatever trace is closest within the snap threshold.
    const y = height / 2;

    // When the hover selection is computed
    const selection = scopeHitTest({ x, y, width, height }, frame);

    // Then the selection identifies session-2, value 47, age near 1.5 seconds
    // (Note: session-2's trace is the only non-quiet trace; the nearest-snap
    // logic will pick it within the snap threshold at this pointer position.)
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("session-2");
    expect(selection?.value).toBeCloseTo(47, 1);
    // Age is near 1.5 seconds (allowing for the fraction-to-time translation).
    expect(selection?.ageMs).toBeGreaterThan(1000);
    expect(selection?.ageMs).toBeLessThan(2000);
  });
});
