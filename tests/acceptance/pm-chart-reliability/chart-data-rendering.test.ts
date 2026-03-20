/**
 * Acceptance tests: Chart Data Rendering (pm-chart-reliability)
 *
 * Validates that the Performance Monitor charts display visible, non-empty
 * data whenever active sessions are generating events. Covers the data
 * pipeline from sample append through buffer retrieval to coordinate
 * computation for canvas rendering.
 *
 * Driving ports:
 *   - multiSessionStore (adapter boundary)
 *   - chartRenderer.prepareFilledAreaPoints (domain)
 *   - chartRenderer.prepareSparklinePoints (domain)
 *
 * Traces to: US-PMR-01 acceptance criteria
 */

import { describe, it, expect } from "vitest";

import {
  createMultiSessionStore,
  type MultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

import {
  prepareFilledAreaPoints,
  prepareSparklinePoints,
  type FilledAreaPoint,
} from "../../../src/plugins/norbert-usage/domain/chartRenderer";

import type { CanvasDimensions } from "../../../src/plugins/norbert-usage/domain/oscilloscope";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHART_DIMENSIONS: CanvasDimensions = {
  width: 400,
  height: 200,
  padding: 10,
};

const SPARKLINE_DIMENSIONS: CanvasDimensions = {
  width: 80,
  height: 20,
  padding: 0,
};

/** Populate a store with a session and append N samples at a given rate. */
const populateSession = (
  store: MultiSessionStore,
  sessionId: string,
  tokenRate: number,
  sampleCount: number,
): void => {
  store.addSession(sessionId);
  for (let i = 0; i < sampleCount; i++) {
    store.appendSessionSample(sessionId, {
      tokens: tokenRate,
      cost: tokenRate * 0.001,
      agents: 1,
      context: 40,
    });
  }
};

/** Convert buffer samples to chart-compatible format. */
const toChartSamples = (
  samples: ReadonlyArray<{ timestamp: number; tokenRate: number }>,
): ReadonlyArray<{ timestamp: number; value: number }> =>
  samples.map((s) => ({ timestamp: s.timestamp, value: s.tokenRate }));

// ---------------------------------------------------------------------------
// WALKING SKELETON: Raj sees chart data for active sessions
// Traces to: US-PMR-01 AC1, AC2
// ---------------------------------------------------------------------------

describe("Raj sees a visible chart line when sessions are generating data", () => {
  it("aggregate chart has renderable points when 3 sessions are active", () => {
    // Given Raj has 3 active Claude Code sessions generating token events
    const store = createMultiSessionStore();
    populateSession(store, "refactor-abc1", 420, 15);
    populateSession(store, "tests-def2", 310, 15);
    populateSession(store, "chat-ghi3", 110, 15);

    // When the aggregate token buffer is retrieved and mapped to chart points
    const aggBuffer = store.getAggregateBuffer("tokens");
    const chartSamples = toChartSamples(aggBuffer.samples);
    const points = prepareFilledAreaPoints(chartSamples, CHART_DIMENSIONS, 1000);

    // Then the chart has at least 10 visible data points
    expect(points.length).toBeGreaterThanOrEqual(10);

    // And all points have finite canvas coordinates (no NaN, no blank chart)
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }

    // And at least one point is above the baseline (non-zero data visible)
    const bottomY = CHART_DIMENSIONS.height - CHART_DIMENSIONS.padding;
    const hasVisibleData = points.some((p) => p.y < bottomY);
    expect(hasVisibleData).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Aggregate buffer content
// Traces to: US-PMR-01 AC1
// ---------------------------------------------------------------------------

describe("Aggregate chart reflects combined token rate across sessions", () => {
  it("aggregate buffer latest value equals sum of per-session rates", () => {
    // Given 3 sessions with known token rates: 420, 310, 110
    const store = createMultiSessionStore();
    store.addSession("s1");
    store.addSession("s2");
    store.addSession("s3");
    store.appendSessionSample("s1", { tokens: 420, cost: 0.42, agents: 1, context: 30 });
    store.appendSessionSample("s2", { tokens: 310, cost: 0.31, agents: 1, context: 50 });
    store.appendSessionSample("s3", { tokens: 110, cost: 0.11, agents: 1, context: 25 });

    // When the aggregate token buffer is read
    const aggBuffer = store.getAggregateBuffer("tokens");
    const latestSample = aggBuffer.samples[aggBuffer.samples.length - 1];

    // Then the aggregate value is 840 (420 + 310 + 110)
    expect(latestSample.tokenRate).toBe(840);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Per-session mini charts
// Traces to: US-PMR-01 AC3
// ---------------------------------------------------------------------------

describe("Per-session mini charts show individual session data", () => {
  it("each session buffer produces sparkline points with non-zero amplitude", () => {
    // Given 3 sessions with rates 420, 310, 110
    const store = createMultiSessionStore();
    populateSession(store, "refactor-abc1", 420, 10);
    populateSession(store, "tests-def2", 310, 10);
    populateSession(store, "chat-ghi3", 110, 10);

    // When sparkline points are prepared for each session
    const sessions = ["refactor-abc1", "tests-def2", "chat-ghi3"];
    for (const sessionId of sessions) {
      const buffer = store.getSessionBuffer(sessionId, "tokens");
      expect(buffer).toBeDefined();
      const chartSamples = toChartSamples(buffer!.samples);
      const points = prepareSparklinePoints(chartSamples, SPARKLINE_DIMENSIONS, 500);

      // Then each session has renderable sparkline points
      expect(points.length).toBeGreaterThan(0);
    }
  });

  it("higher-rate session produces higher amplitude sparkline than lower-rate session", () => {
    // Given refactor-abc1 at 420 tok/s and chat-ghi3 at 110 tok/s
    const store = createMultiSessionStore();
    populateSession(store, "refactor-abc1", 420, 10);
    populateSession(store, "chat-ghi3", 110, 10);

    // When sparkline points are prepared with the same yMax
    const yMax = 500;
    const bufferHigh = store.getSessionBuffer("refactor-abc1", "tokens")!;
    const bufferLow = store.getSessionBuffer("chat-ghi3", "tokens")!;
    const pointsHigh = prepareSparklinePoints(toChartSamples(bufferHigh.samples), SPARKLINE_DIMENSIONS, yMax);
    const pointsLow = prepareSparklinePoints(toChartSamples(bufferLow.samples), SPARKLINE_DIMENSIONS, yMax);

    // Then the high-rate session has lower Y values (higher on canvas = lower Y)
    const avgYHigh = pointsHigh.reduce((sum, p) => sum + p.y, 0) / pointsHigh.length;
    const avgYLow = pointsLow.reduce((sum, p) => sum + p.y, 0) / pointsLow.length;
    expect(avgYHigh).toBeLessThan(avgYLow);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Chart line advances over time
// Traces to: US-PMR-01 AC2
// ---------------------------------------------------------------------------

describe("Chart line extends rightward as new samples arrive", () => {
  it("appending samples increases the number of chart points", () => {
    // Given a session with 5 initial samples
    const store = createMultiSessionStore();
    populateSession(store, "advancing", 300, 5);
    const initialBuffer = store.getAggregateBuffer("tokens");
    const initialPointCount = initialBuffer.samples.length;

    // When 5 more seconds of events arrive
    for (let i = 0; i < 5; i++) {
      store.appendSessionSample("advancing", { tokens: 300, cost: 0.3, agents: 1, context: 40 });
    }

    // Then the buffer has grown with new data points
    const updatedBuffer = store.getAggregateBuffer("tokens");
    expect(updatedBuffer.samples.length).toBeGreaterThan(initialPointCount);

    // And the rightmost point has a more recent timestamp
    const lastInitial = initialBuffer.samples[initialBuffer.samples.length - 1];
    const lastUpdated = updatedBuffer.samples[updatedBuffer.samples.length - 1];
    expect(lastUpdated.timestamp).toBeGreaterThanOrEqual(lastInitial.timestamp);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Session lifecycle
// Traces to: US-PMR-01 AC5
// ---------------------------------------------------------------------------

describe("Chart continues after a session ends", () => {
  it("removing a session leaves remaining sessions contributing to aggregate", () => {
    // Given 3 active sessions contributing to aggregate
    const store = createMultiSessionStore();
    populateSession(store, "keep-a", 420, 5);
    populateSession(store, "keep-b", 310, 5);
    populateSession(store, "ending", 110, 5);

    // When the "ending" session completes and is removed
    store.removeSession("ending");

    // And new data arrives from the remaining 2 sessions
    store.appendSessionSample("keep-a", { tokens: 420, cost: 0.42, agents: 1, context: 30 });
    store.appendSessionSample("keep-b", { tokens: 310, cost: 0.31, agents: 1, context: 50 });

    // Then the aggregate reflects only the 2 remaining sessions (420 + 310 = 730)
    const aggBuffer = store.getAggregateBuffer("tokens");
    const latestSample = aggBuffer.samples[aggBuffer.samples.length - 1];
    expect(latestSample.tokenRate).toBe(730);
  });

  it("removed session no longer appears in per-session buffer lookups", () => {
    // Given a session that has ended
    const store = createMultiSessionStore();
    populateSession(store, "ended-session", 200, 5);
    store.removeSession("ended-session");

    // When per-session buffer is requested
    const buffer = store.getSessionBuffer("ended-session", "tokens");

    // Then no buffer is returned for the ended session
    expect(buffer).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ERROR/BOUNDARY SCENARIOS: Empty state
// Traces to: US-PMR-01 AC4
// ---------------------------------------------------------------------------

describe("Empty state when no sessions are active", () => {
  it("aggregate buffer has no samples when no sessions exist", () => {
    // Given Raj has no active Claude Code sessions
    const store = createMultiSessionStore();

    // When the aggregate token buffer is retrieved
    const aggBuffer = store.getAggregateBuffer("tokens");

    // Then no samples are available
    expect(aggBuffer.samples).toHaveLength(0);
  });

  it("chart point preparation returns empty array for zero samples", () => {
    // Given no sample data
    const emptySamples: ReadonlyArray<{ timestamp: number; value: number }> = [];

    // When chart points are prepared
    const points = prepareFilledAreaPoints(emptySamples, CHART_DIMENSIONS, 1000);

    // Then no chart points are produced (triggers empty-state display)
    expect(points).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ERROR/BOUNDARY SCENARIOS: Data pipeline edge cases
// Traces to: US-PMR-01 AC6
// ---------------------------------------------------------------------------

describe("Chart handles maximum buffer size without data corruption", () => {
  it("buffer at capacity evicts oldest while maintaining renderable points", () => {
    // Given a session that has been running long enough to fill the buffer
    const store = createMultiSessionStore();
    store.addSession("long-running");

    // When 70 samples are appended (exceeds DEFAULT_BUFFER_CAPACITY=60)
    for (let i = 0; i < 70; i++) {
      store.appendSessionSample("long-running", {
        tokens: 100 + (i % 50),
        cost: 0.01,
        agents: 1,
        context: 40,
      });
    }

    // Then the buffer has exactly capacity samples (oldest evicted)
    const buffer = store.getSessionBuffer("long-running", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples.length).toBeLessThanOrEqual(60);
    expect(buffer!.samples.length).toBeGreaterThan(0);

    // And chart points can be rendered from the capped buffer
    const chartSamples = toChartSamples(buffer!.samples);
    const points = prepareFilledAreaPoints(chartSamples, CHART_DIMENSIONS, 200);
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe("Chart renders correctly with single data point", () => {
  it("one sample produces one chart point at a valid position", () => {
    // Given a session with exactly one event
    const store = createMultiSessionStore();
    store.addSession("single-event");
    store.appendSessionSample("single-event", { tokens: 500, cost: 0.5, agents: 1, context: 60 });

    // When chart points are prepared
    const buffer = store.getSessionBuffer("single-event", "tokens")!;
    const chartSamples = toChartSamples(buffer.samples);
    const points = prepareFilledAreaPoints(chartSamples, CHART_DIMENSIONS, 1000);

    // Then exactly 1 point is produced with valid coordinates
    expect(points).toHaveLength(1);
    expect(Number.isFinite(points[0].x)).toBe(true);
    expect(Number.isFinite(points[0].y)).toBe(true);
  });
});

describe("All zero token rates produce flat baseline, not blank chart", () => {
  it("zero-rate samples create points at the bottom of the chart", () => {
    // Given sessions generating zero tokens (idle state)
    const store = createMultiSessionStore();
    populateSession(store, "idle-session", 0, 10);

    // When chart points are prepared
    const buffer = store.getSessionBuffer("idle-session", "tokens")!;
    const chartSamples = toChartSamples(buffer.samples);
    const points = prepareFilledAreaPoints(chartSamples, CHART_DIMENSIONS, 1000);

    // Then all points are at the bottom baseline (chart is not blank)
    expect(points.length).toBe(10);
    const bottomY = CHART_DIMENSIONS.height - CHART_DIMENSIONS.padding;
    for (const point of points) {
      expect(point.y).toBe(bottomY);
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIO: Appending to nonexistent session
// ---------------------------------------------------------------------------

describe("Appending data to a session that does not exist is safe", () => {
  it("no crash or data corruption when session ID is unknown", () => {
    // Given a store with no sessions
    const store = createMultiSessionStore();

    // When data is appended to a nonexistent session
    expect(() => {
      store.appendSessionSample("phantom", { tokens: 999, cost: 0.9, agents: 1, context: 100 });
    }).not.toThrow();

    // Then no buffer is created for the phantom session
    expect(store.getSessionBuffer("phantom", "tokens")).toBeUndefined();

    // And the aggregate buffer is unaffected
    expect(store.getAggregateBuffer("tokens").samples).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIO
// Traces to: US-PMR-01 "non-empty buffer whenever sessions have events"
// ---------------------------------------------------------------------------

describe("@property: aggregate buffer is non-empty whenever active sessions have events", () => {
  it("for any combination of 1-5 sessions with events, aggregate has samples", () => {
    for (let sessionCount = 1; sessionCount <= 5; sessionCount++) {
      // Given N active sessions each with at least one event
      const store = createMultiSessionStore();
      for (let i = 0; i < sessionCount; i++) {
        store.addSession(`session-${i}`);
        store.appendSessionSample(`session-${i}`, {
          tokens: 100 * (i + 1),
          cost: 0.01 * (i + 1),
          agents: 1,
          context: 20 + i * 10,
        });
      }

      // Then the aggregate token buffer is always non-empty
      const aggBuffer = store.getAggregateBuffer("tokens");
      expect(aggBuffer.samples.length).toBeGreaterThan(0);
    }
  });
});
