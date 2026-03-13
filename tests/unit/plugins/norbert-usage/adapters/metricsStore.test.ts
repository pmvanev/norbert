/**
 * Unit tests: metricsStore adapter (Step 03-03)
 *
 * The metricsStore is the ONLY mutable cell in the norbert-usage plugin.
 * It holds current SessionMetrics + TimeSeriesBuffer, notifies subscribers
 * on state change, and returns unsubscribe functions.
 *
 * Behaviors tested:
 * - Initial state returns zeroed metrics for given session ID
 * - getMetrics/getTimeSeries return current state
 * - update() replaces state and notifies all subscribers
 * - subscribe() returns unsubscribe function that stops notifications
 * - Multiple subscribers all receive updates
 * - Unsubscribed callback is not called on subsequent updates
 */

import { describe, it, expect } from "vitest";
import { createMetricsStore } from "../../../../../src/plugins/norbert-usage/adapters/metricsStore";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { createBuffer } from "../../../../../src/plugins/norbert-usage/domain/timeSeriesSampler";
import type { SessionMetrics, TimeSeriesBuffer } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMetrics = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  ...overrides,
});

const makeTimeSeries = (capacity = 60): TimeSeriesBuffer =>
  createBuffer(capacity);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("metricsStore initial state", () => {
  it("returns zeroed metrics with provided session ID", () => {
    const store = createMetricsStore("my-session");
    const metrics = store.getMetrics();

    expect(metrics.sessionId).toBe("my-session");
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.hookEventCount).toBe(0);
  });

  it("returns empty time series buffer", () => {
    const store = createMetricsStore("my-session");
    const timeSeries = store.getTimeSeries();

    expect(timeSeries.samples).toEqual([]);
    expect(timeSeries.capacity).toBeGreaterThan(0);
  });

  it("uses default session ID when none provided", () => {
    const store = createMetricsStore();
    const metrics = store.getMetrics();

    expect(metrics.sessionId).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// update() replaces state and notifies subscribers
// ---------------------------------------------------------------------------

describe("metricsStore update", () => {
  it("replaces metrics state accessible via getMetrics", () => {
    const store = createMetricsStore("s1");
    const updated = makeMetrics({ sessionId: "s1", totalTokens: 500, sessionCost: 1.5 });
    const timeSeries = makeTimeSeries();

    store.update(updated, timeSeries);

    expect(store.getMetrics().totalTokens).toBe(500);
    expect(store.getMetrics().sessionCost).toBe(1.5);
  });

  it("replaces time series state accessible via getTimeSeries", () => {
    const store = createMetricsStore("s1");
    const metrics = makeMetrics({ sessionId: "s1" });
    const timeSeries: TimeSeriesBuffer = {
      samples: [{ timestamp: 1000, tokenRate: 10, costRate: 0.01 }],
      capacity: 60,
      headIndex: 0,
    };

    store.update(metrics, timeSeries);

    expect(store.getTimeSeries().samples).toHaveLength(1);
    expect(store.getTimeSeries().samples[0].tokenRate).toBe(10);
  });

  it("notifies subscriber with new metrics and time series", () => {
    const store = createMetricsStore("s1");
    const received: Array<{ metrics: SessionMetrics; timeSeries: TimeSeriesBuffer }> = [];

    store.subscribe((metrics, timeSeries) => {
      received.push({ metrics, timeSeries });
    });

    const updated = makeMetrics({ sessionId: "s1", totalTokens: 100 });
    const timeSeries = makeTimeSeries();
    store.update(updated, timeSeries);

    expect(received).toHaveLength(1);
    expect(received[0].metrics.totalTokens).toBe(100);
  });

  it("notifies all subscribers on each update", () => {
    const store = createMetricsStore("s1");
    let callCountA = 0;
    let callCountB = 0;

    store.subscribe(() => { callCountA += 1; });
    store.subscribe(() => { callCountB += 1; });

    store.update(makeMetrics(), makeTimeSeries());

    expect(callCountA).toBe(1);
    expect(callCountB).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// subscribe() returns unsubscribe function
// ---------------------------------------------------------------------------

describe("metricsStore subscribe/unsubscribe", () => {
  it("returns a function that stops notifications", () => {
    const store = createMetricsStore("s1");
    let callCount = 0;

    const unsubscribe = store.subscribe(() => { callCount += 1; });

    store.update(makeMetrics(), makeTimeSeries());
    expect(callCount).toBe(1);

    unsubscribe();

    store.update(makeMetrics(), makeTimeSeries());
    expect(callCount).toBe(1); // not called again
  });

  it("does not affect other subscribers when one unsubscribes", () => {
    const store = createMetricsStore("s1");
    let callCountA = 0;
    let callCountB = 0;

    const unsubA = store.subscribe(() => { callCountA += 1; });
    store.subscribe(() => { callCountB += 1; });

    store.update(makeMetrics(), makeTimeSeries());
    expect(callCountA).toBe(1);
    expect(callCountB).toBe(1);

    unsubA();

    store.update(makeMetrics(), makeTimeSeries());
    expect(callCountA).toBe(1); // stopped
    expect(callCountB).toBe(2); // still receiving
  });
});
