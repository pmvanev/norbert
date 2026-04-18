/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Milestone 3
 * Metric Toggle.
 *
 * The user toggles the Y-axis metric between Events/s, Tokens/s, Tool-calls/s.
 * Each metric has its own Y-axis scale, unit, and per-session arrived history.
 * At the toggle boundary the persistence buffer is reset so afterglow from the
 * prior metric cannot mislead at the new scale.
 *
 * Driving ports (DELIVER wave will implement):
 *   - buildFrame(store, metric, now) -> Frame  (pure re-projection per metric)
 *   - scopeHitTest(pointer, frame) -> HoverSelection | null  (pure hover hit-test)
 *   - multiSessionStore.appendRateSample (per-metric)
 *
 * Feature file: milestone-3-metric-toggle.feature
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q3
 * (persistence-buffer reset invariant), ADR-048, ADR-049.
 */

import { describe, it, expect } from "vitest";

import {
  METRICS,
  NOW,
  WINDOW_MS,
  type Frame,
  type HoverSelection,
  type MetricId,
  type MultiSessionStoreSurface,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (resolved as DELIVER wave lands modules).
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { DEFAULT_METRIC } from "../../../../src/plugins/norbert-usage/domain/phosphor/phosphorMetricConfig";
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// Not yet landed — still declared for later scenarios in this file.
declare const scopeHitTest: (
  pointer: { x: number; y: number; width: number; height: number },
  frame: Frame,
) => HoverSelection | null;

// ---------------------------------------------------------------------------
// M3-S1: Default metric at first launch is Events per second
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason.
// ---------------------------------------------------------------------------

describe("M3-S1: Default metric at first launch is Events per second", () => {
  it("first frame's metric is events and yMax is 15", () => {
    // Given the view opens for the first time (empty store, default metric)
    const store = createMultiSessionStore();

    // When the scope projects its first frame with the default metric — the
    // view initializes its selectedMetric from DEFAULT_METRIC, so the test
    // reaches through that same constant rather than hard-coding "events".
    const frame = buildFrame(store, DEFAULT_METRIC, NOW);

    // Then the frame metric is events and its yMax is 15
    expect(DEFAULT_METRIC).toBe("events");
    expect(frame.metric).toBe("events");
    expect(frame.yMax).toBe(METRICS.events.yMax);
    expect(frame.yMax).toBe(15);
    expect(frame.unit).toBe(METRICS.events.unit);
  });
});

// ---------------------------------------------------------------------------
// M3-S2: Switching to Tokens per second re-projects with the tokens scale
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M3-S2: Switching to Tokens per second re-projects with the tokens scale", () => {
  it("next frame uses tokens history with yMax 100 and tokens unit", () => {
    // Given session-1 has arrived tokens-per-second history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const tokenHistory = synthesizeArrivedHistory(12, (i) => 20 + i * 3);
    for (const s of tokenHistory) store.appendRateSample("session-1", "tokens", s.t, s.v);

    // When the user selects Tokens per second (view re-projects)
    const frame = buildFrame(store, "tokens", NOW);

    // Then the frame's metric, yMax, and unit reflect tokens
    expect(frame.metric).toBe("tokens");
    expect(frame.yMax).toBe(METRICS.tokens.yMax);
    expect(frame.yMax).toBe(100);
    expect(frame.unit).toBe(METRICS.tokens.unit);

    // And session-1's trace contains tokens values
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.samples.length).toBeGreaterThan(0);
    expect(trace!.latestValue).toBeCloseTo(
      tokenHistory[tokenHistory.length - 1].v,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// M3-S3: Switching to Tool-calls per second re-projects with the tool-calls scale
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M3-S3: Switching to Tool-calls per second re-projects with the tool-calls scale", () => {
  it("next frame uses tool-calls history with yMax 3 and tool-calls unit", () => {
    // Given session-1 has arrived tool-calls-per-second history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const toolHistory = synthesizeArrivedHistory(12, (i) => 0.4 + i * 0.1);
    for (const s of toolHistory) store.appendRateSample("session-1", "toolcalls", s.t, s.v);

    // When the user selects Tool-calls per second
    const frame = buildFrame(store, "toolcalls", NOW);

    // Then the frame metric, yMax, and unit reflect tool-calls
    expect(frame.metric).toBe("toolcalls");
    expect(frame.yMax).toBe(METRICS.toolcalls.yMax);
    expect(frame.yMax).toBe(3);
    expect(frame.unit).toBe(METRICS.toolcalls.unit);

    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.latestValue).toBeCloseTo(
      toolHistory[toolHistory.length - 1].v,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// M3-S4: Persistence buffer is reset at the metric-change boundary
// Tag: @driving_port @US-PM-001
//
// The persistence-buffer reset is a view-internal effect. Acceptance tests
// observe its user-visible consequence: the post-toggle frame carries no
// sample values from the prior metric's history, and its Y-axis scale is the
// new metric's scale — never the prior metric's. We therefore observe the
// contract through buildFrame alone, the driving port listed in D7 / §Q7.
// ---------------------------------------------------------------------------

describe.skip("M3-S4: Persistence buffer is reset at the metric-change boundary", () => {
  it("post-toggle frame uses the new metric's scale and carries no prior-metric sample values", () => {
    // Given session-1 has non-trivial Events per second arrived history and no
    // tokens history (so any value carried over would be unambiguously from the
    // events history).
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const eventsHistory = synthesizeArrivedHistory(12, (i) => 4 + i * 0.5);
    for (const s of eventsHistory) {
      store.appendRateSample("session-1", "events", s.t, s.v);
    }

    // And the scope has projected a frame under the Events per second metric
    const frameEvents = buildFrame(store, "events", NOW);
    const eventsTrace = frameEvents.traces.find(
      (t) => t.sessionId === "session-1",
    );
    expect(eventsTrace).toBeDefined();
    expect(eventsTrace!.samples.length).toBeGreaterThan(0);
    const eventsValues = new Set(eventsTrace!.samples.map((s) => s.v));

    // When the user selects Tokens per second (view re-projects)
    const frameTokens = buildFrame(store, "tokens", NOW);

    // Then the post-toggle frame uses the Tokens per second Y-axis scale, not
    // the Events per second scale — proving prior-metric scale did not carry.
    expect(frameTokens.metric).toBe("tokens");
    expect(frameTokens.yMax).toBe(METRICS.tokens.yMax);
    expect(frameTokens.yMax).not.toBe(METRICS.events.yMax);
    expect(frameTokens.unit).toBe(METRICS.tokens.unit);

    // And session-1's trace in the post-toggle frame carries no sample values
    // from the prior Events per second history.
    const tokensTrace = frameTokens.traces.find(
      (t) => t.sessionId === "session-1",
    );
    expect(tokensTrace).toBeDefined();
    expect(tokensTrace!.samples).toHaveLength(0);
    expect(tokensTrace!.latestValue).toBeNull();

    // And no sample value from the events history appears anywhere in the
    // post-toggle frame's traces (no afterglow carry-over across metrics).
    for (const trace of frameTokens.traces) {
      for (const sample of trace.samples) {
        expect(eventsValues.has(sample.v)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// M3-S5: Toggling back to the original metric re-projects from its own history
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M3-S5: Toggling back to the original metric re-projects from its own history", () => {
  it("events history is restored untouched after a round-trip through tokens", () => {
    // Given session-1 has arrived history for both events and tokens
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const eventHistory = synthesizeArrivedHistory(12, (i) => 4 + i * 0.2);
    const tokenHistory = synthesizeArrivedHistory(12, (i) => 50 + i * 2);
    for (const s of eventHistory) store.appendRateSample("session-1", "events", s.t, s.v);
    for (const s of tokenHistory) store.appendRateSample("session-1", "tokens", s.t, s.v);

    // Round-trip: events -> tokens -> events
    buildFrame(store, "tokens", NOW);
    const frame = buildFrame(store, "events", NOW);

    // Then the frame uses events history and yMax 15
    expect(frame.metric).toBe("events");
    expect(frame.yMax).toBe(METRICS.events.yMax);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();
    expect(trace!.latestValue).toBeCloseTo(
      eventHistory[eventHistory.length - 1].v,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// M3-S6: A session with history for one metric but not another produces an
//        empty trace after toggle
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("M3-S6: A session with history for one metric but not another projects an empty trace after toggle", () => {
  it("session appears but with empty samples and placeholder legend value", () => {
    // Given session-1 has events history but no tokens history
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const eventHistory = synthesizeArrivedHistory(12, () => 5);
    for (const s of eventHistory) store.appendRateSample("session-1", "events", s.t, s.v);

    // When the user toggles to tokens
    const frame = buildFrame(store, "tokens", NOW);

    // Then session-1 is present but the trace is empty
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
// M3-S7: Hover is cleared when the metric changes
// Tag: @driving_port @US-PM-001
//
// A hover selection is stale the moment the metric toggles because the pointer
// position was meaningful under the prior metric's Y-axis scale. Acceptance
// tests observe this through the scope-level seam: the same pointer position
// that produced a non-null hover on the events-scale frame must not produce a
// hover on the tokens-scale frame when the tokens history is absent or
// projected far from that pointer's Y-coordinate. The seam is buildFrame +
// scopeHitTest, both listed in D7 / §Q7.
// ---------------------------------------------------------------------------

describe.skip("M3-S7: Hover is cleared when the metric changes", () => {
  it("the same pointer position yields a hover under the events scale but no hover under the tokens scale", () => {
    // Given session-1 has Events per second history at 12 evt/s and no tokens
    // history, so the events-scale trace sits near the top of the scope but the
    // tokens-scale projection for session-1 is empty.
    const WIDTH = 1000;
    const HEIGHT = 400;

    const store = createMultiSessionStore();
    store.addSession("session-1");
    const s1History = synthesizeArrivedHistory(12, () => 12);
    for (const s of s1History) {
      store.appendRateSample("session-1", "events", s.t, s.v);
    }

    // And the user is hovering on session-1's trace on the Events per second
    // scale: resolve the pointer coordinates from the events frame so the
    // selection is definitely non-null before the toggle.
    const frameEvents = buildFrame(store, "events", NOW);
    const eventsTrace = frameEvents.traces.find(
      (t) => t.sessionId === "session-1",
    );
    expect(eventsTrace).toBeDefined();
    const targetSample = eventsTrace!.samples.reduce((best, s) =>
      Math.abs(s.t - (NOW - 2000)) < Math.abs(best.t - (NOW - 2000)) ? s : best,
    );
    const pointerX = WIDTH * (1 - (NOW - targetSample.t) / WINDOW_MS);
    const pointerY =
      HEIGHT - (targetSample.v / frameEvents.yMax) * HEIGHT;

    const hoverBefore = scopeHitTest(
      { x: pointerX, y: pointerY, width: WIDTH, height: HEIGHT },
      frameEvents,
    );
    expect(hoverBefore).not.toBeNull();
    expect(hoverBefore!.sessionId).toBe("session-1");

    // When the user selects Tokens per second (view re-projects)
    const frameTokens = buildFrame(store, "tokens", NOW);

    // Then the same pointer position no longer hits any trace, because the
    // tokens-scale projection for session-1 is empty (no tokens history) — the
    // prior hover is stale under the new metric's scale.
    const hoverAfter = scopeHitTest(
      { x: pointerX, y: pointerY, width: WIDTH, height: HEIGHT },
      frameTokens,
    );
    expect(hoverAfter).toBeNull();
  });
});
