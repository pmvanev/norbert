/**
 * Acceptance tests: Time Window Switching (pm-chart-reliability)
 *
 * Validates that clicking a time window button (1m, 5m, 15m, Session)
 * changes the data buffer displayed in the chart. Tests exercise the
 * multiWindowSampler domain functions and the planned integration with
 * multiSessionStore for window-aware buffer retrieval.
 *
 * Driving ports:
 *   - multiWindowSampler (domain: createMultiWindowBuffer, appendMultiWindowSample, getActiveWindowSamples)
 *   - multiSessionStore (adapter: getAggregateWindowBuffer, getSessionWindowBuffer) -- SKIP until wired
 *
 * Traces to: US-PMR-03 acceptance criteria
 */

import { describe, it, expect } from "vitest";

import {
  createMultiWindowBuffer,
  appendMultiWindowSample,
  getActiveWindowSamples,
  resolveSessionWindowConfig,
  TIME_WINDOW_PRESETS,
  type MultiWindowBuffer,
} from "../../../src/plugins/norbert-usage/domain/multiWindowSampler";

import type { RateSample } from "../../../src/plugins/norbert-usage/domain/types";

import {
  prepareFilledAreaPoints,
} from "../../../src/plugins/norbert-usage/domain/chartRenderer";

import type { CanvasDimensions } from "../../../src/plugins/norbert-usage/domain/oscilloscope";

import {
  createMultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHART_DIMENSIONS: CanvasDimensions = {
  width: 400,
  height: 200,
  padding: 10,
};

/** Create a RateSample at a given timestamp. */
const sample = (timestamp: number, tokenRate: number): RateSample => ({
  timestamp,
  tokenRate,
  costRate: tokenRate * 0.001,
});

/** Populate a multi-window buffer with samples at regular intervals. */
const populateBuffer = (
  intervalMs: number,
  count: number,
  baseRate: number,
): MultiWindowBuffer => {
  let buffer = createMultiWindowBuffer();
  const startTime = 1000;
  for (let i = 0; i < count; i++) {
    buffer = appendMultiWindowSample(buffer, sample(startTime + i * intervalMs, baseRate + (i % 50)));
  }
  return buffer;
};

// ---------------------------------------------------------------------------
// WALKING SKELETON: Raj switches to 5m window and sees wider data range
// Traces to: US-PMR-03 AC1, AC2, AC3
// ---------------------------------------------------------------------------

describe("Raj switches time window and sees data from a different resolution buffer", () => {
  it("1m and 5m windows contain different numbers of samples for the same input stream", () => {
    // Given Raj's session has been active for 6 minutes, generating events every 100ms
    // (100ms is the 1m window sample interval)
    const sixMinutesOfSamples = 6 * 60 * 10; // 3600 samples at 100ms intervals
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < sixMinutesOfSamples; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 400 + (i % 100)));
    }

    // When Raj views the 1m window
    const samples1m = getActiveWindowSamples(buffer, "1m");

    // Then the 1m buffer has up to 600 samples (1-minute window capacity)
    expect(samples1m.length).toBeLessThanOrEqual(600);
    expect(samples1m.length).toBeGreaterThan(0);

    // When Raj clicks the "5m" time window button
    const samples5m = getActiveWindowSamples(buffer, "5m");

    // Then the 5m buffer has samples covering a wider time range
    expect(samples5m.length).toBeGreaterThan(0);
    expect(samples5m.length).toBeLessThanOrEqual(600);

    // And the 5m buffer's time span is wider than the 1m buffer's
    const timeSpan1m = samples1m[samples1m.length - 1].timestamp - samples1m[0].timestamp;
    const timeSpan5m = samples5m[samples5m.length - 1].timestamp - samples5m[0].timestamp;
    expect(timeSpan5m).toBeGreaterThan(timeSpan1m);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Each window resolution
// Traces to: US-PMR-03 AC2, AC3, AC4
// ---------------------------------------------------------------------------

describe("1-minute window provides high-resolution data at 100ms intervals", () => {
  it("1m buffer accepts samples at 100ms interval", () => {
    // Given events arriving every 100ms for 30 seconds
    const buffer = populateBuffer(100, 300, 500);

    // When the 1m window samples are retrieved
    const samples = getActiveWindowSamples(buffer, "1m");

    // Then all 300 samples are captured (within 600 capacity)
    expect(samples.length).toBe(300);
  });
});

describe("5-minute window downsamples to 500ms intervals", () => {
  it("5m buffer captures fewer samples from high-frequency input", () => {
    // Given events arriving every 100ms for 2 minutes (1200 events)
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 1200; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 300));
    }

    // When the 5m window samples are retrieved
    const samples5m = getActiveWindowSamples(buffer, "5m");

    // Then fewer samples exist (downsampled at 500ms intervals)
    // 120 seconds / 0.5s interval = ~240 samples
    expect(samples5m.length).toBeLessThan(1200);
    expect(samples5m.length).toBeGreaterThan(0);
  });
});

describe("15-minute window downsamples to 1000ms intervals", () => {
  it("15m buffer captures at 1-second intervals", () => {
    // Given events arriving every 100ms for 5 minutes (3000 events)
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 3000; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 200));
    }

    // When the 15m window samples are retrieved
    const samples15m = getActiveWindowSamples(buffer, "15m");

    // Then samples are at 1-second intervals (~300 samples for 5 minutes)
    expect(samples15m.length).toBeLessThan(3000);
    expect(samples15m.length).toBeGreaterThan(0);
    expect(samples15m.length).toBeLessThanOrEqual(900); // 15m capacity
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Window switching preserves resolution
// Traces to: US-PMR-03 AC6 (independent concurrent buffers)
// ---------------------------------------------------------------------------

describe("Returning to 1m preserves high-resolution data", () => {
  it("1m buffer retains full resolution while 5m view was active", () => {
    // Given Raj has been viewing data for 2 minutes
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 1200; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 350 + (i % 30)));
    }

    // When Raj was viewing 5m and switches back to 1m
    const samples5m = getActiveWindowSamples(buffer, "5m");
    const samples1m = getActiveWindowSamples(buffer, "1m");

    // Then the 1m data has higher density than the 5m data
    expect(samples1m.length).toBeGreaterThan(samples5m.length);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Data is renderable from each window
// ---------------------------------------------------------------------------

describe("Each window buffer produces valid chart points", () => {
  it("all three preset windows produce non-empty chart coordinates", () => {
    // Given a populated multi-window buffer
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 2000; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 250 + (i % 50)));
    }

    // When chart points are prepared for each window
    for (const preset of TIME_WINDOW_PRESETS) {
      const samples = getActiveWindowSamples(buffer, preset.label as "1m" | "5m" | "15m");
      const chartSamples = samples.map((s) => ({ timestamp: s.timestamp, value: s.tokenRate }));
      const points = prepareFilledAreaPoints(chartSamples, CHART_DIMENSIONS, 400);

      // Then each window has renderable points
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR/BOUNDARY SCENARIOS: Session shorter than window
// Traces to: US-PMR-03 domain example 2
// ---------------------------------------------------------------------------

describe("Session shorter than selected window shows available data only", () => {
  it("3-minute session viewed in 15m window shows 3 minutes of data", () => {
    // Given Raj's session has only been active for 3 minutes
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 1800; i++) { // 3 min at 100ms = 1800 events
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 400));
    }

    // When the 15m window is selected
    const samples15m = getActiveWindowSamples(buffer, "15m");

    // Then only the available data is shown (no misleading empty padding)
    expect(samples15m.length).toBeGreaterThan(0);
    // The time span matches approximately 3 minutes
    const timeSpanMs = samples15m[samples15m.length - 1].timestamp - samples15m[0].timestamp;
    expect(timeSpanMs).toBeLessThanOrEqual(180_000 + 1_000); // ~3 minutes
  });
});

// ---------------------------------------------------------------------------
// ERROR/BOUNDARY SCENARIOS: Empty buffer for unvisited window
// ---------------------------------------------------------------------------

describe("Window with no accumulated data returns empty samples", () => {
  it("newly created buffer returns empty for all windows", () => {
    // Given a fresh multi-window buffer with no data
    const buffer = createMultiWindowBuffer();

    // When any window is queried
    const samples1m = getActiveWindowSamples(buffer, "1m");
    const samples5m = getActiveWindowSamples(buffer, "5m");
    const samples15m = getActiveWindowSamples(buffer, "15m");

    // Then all windows are empty
    expect(samples1m).toHaveLength(0);
    expect(samples5m).toHaveLength(0);
    expect(samples15m).toHaveLength(0);
  });
});

describe("Requesting an unknown window ID returns empty samples", () => {
  it("invalid window ID returns empty array gracefully", () => {
    // Given a populated buffer
    const buffer = populateBuffer(100, 50, 300);

    // When an unknown window ID is requested
    const samples = getActiveWindowSamples(buffer, "30m" as any);

    // Then empty samples are returned (no crash)
    expect(samples).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIO: Session-length window configuration
// Traces to: US-PMR-03 AC5
// ---------------------------------------------------------------------------

describe("Session window dynamically adjusts sample interval based on duration", () => {
  it("45-minute session produces reasonable sample interval and capacity", () => {
    // Given a session that has been active for 45 minutes
    const sessionDurationMs = 45 * 60 * 1000;

    // When the session window configuration is resolved
    const config = resolveSessionWindowConfig(sessionDurationMs);

    // Then the interval and capacity produce a usable chart
    expect(config.label).toBe("session");
    expect(config.durationMs).toBe(sessionDurationMs);
    expect(config.bufferCapacity).toBeGreaterThanOrEqual(300);
    expect(config.bufferCapacity).toBeLessThanOrEqual(900);
    expect(config.sampleIntervalMs).toBeGreaterThan(0);
  });

  it("short 2-minute session still produces a valid configuration", () => {
    // Given a very short session of 2 minutes
    const config = resolveSessionWindowConfig(2 * 60 * 1000);

    // Then the configuration is still valid
    expect(config.bufferCapacity).toBeGreaterThanOrEqual(300);
    expect(config.sampleIntervalMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIO: All windows accumulate concurrently
// Traces to: US-PMR-03 AC6
// ---------------------------------------------------------------------------

describe("All four windows accumulate data independently and concurrently", () => {
  it("a single append call feeds all three preset windows based on interval", () => {
    // Given an empty multi-window buffer
    let buffer = createMultiWindowBuffer();

    // When a burst of samples arrives spanning 2 seconds (at 100ms intervals)
    for (let i = 0; i < 20; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 500));
    }

    // Then the 1m window (100ms interval) has all 20 samples
    const samples1m = getActiveWindowSamples(buffer, "1m");
    expect(samples1m.length).toBe(20);

    // And the 5m window (500ms interval) has fewer samples (~4)
    const samples5m = getActiveWindowSamples(buffer, "5m");
    expect(samples5m.length).toBeGreaterThan(0);
    expect(samples5m.length).toBeLessThan(20);

    // And the 15m window (1000ms interval) has even fewer (~2)
    const samples15m = getActiveWindowSamples(buffer, "15m");
    expect(samples15m.length).toBeGreaterThan(0);
    expect(samples15m.length).toBeLessThanOrEqual(samples5m.length);
  });
});

// ---------------------------------------------------------------------------
// STORE INTEGRATION: Window-aware buffer retrieval
// Traces to: US-PMR-03 AC1 (clicking button changes data buffer)
// These tests are SKIPPED until multiSessionStore is wired to multiWindowSampler
// ---------------------------------------------------------------------------

describe("Store provides window-specific buffers via multiSessionStore wiring", () => {
  it("getAggregateWindowBuffer returns different data for 1m vs 5m", () => {
    // Given a store with two sessions generating samples at 100ms intervals for 2 seconds
    const store = createMultiSessionStore();
    store.addSession("s1");
    store.addSession("s2");

    // Append enough samples to differentiate 1m (100ms interval) from 5m (500ms interval)
    for (let i = 0; i < 20; i++) {
      store.appendSessionSample("s1", { tokens: 300, cost: 0.003, agents: 1, context: 40 });
      store.appendSessionSample("s2", { tokens: 200, cost: 0.002, agents: 1, context: 30 });
    }

    // When getAggregateWindowBuffer is called for 1m and 5m
    const buffer1m = store.getAggregateWindowBuffer("tokens", "1m");
    const buffer5m = store.getAggregateWindowBuffer("tokens", "5m");

    // Then both buffers have samples
    expect(buffer1m).toBeDefined();
    expect(buffer1m.samples.length).toBeGreaterThan(0);
    expect(buffer5m).toBeDefined();
    expect(buffer5m.samples.length).toBeGreaterThan(0);

    // And the 1m buffer has at least as many samples as the 5m buffer
    expect(buffer1m.samples.length).toBeGreaterThanOrEqual(buffer5m.samples.length);
  });

  it("getSessionWindowBuffer returns per-session data for selected window", () => {
    // Given a store with a session that has received samples
    const store = createMultiSessionStore();
    store.addSession("refactor-abc1");

    for (let i = 0; i < 10; i++) {
      store.appendSessionSample("refactor-abc1", { tokens: 450, cost: 0.004, agents: 2, context: 55 });
    }

    // When getSessionWindowBuffer is called for a specific session and window
    const buffer5m = store.getSessionWindowBuffer("refactor-abc1", "tokens", "5m");

    // Then the buffer contains session-specific data at 5m resolution
    expect(buffer5m).toBeDefined();
    expect(buffer5m!.samples.length).toBeGreaterThan(0);
  });

  it("appendSessionSample feeds all three window buffers per category", () => {
    // Given a store with one session
    const store = createMultiSessionStore();
    store.addSession("multi-win");

    // When enough samples are appended to populate all windows
    for (let i = 0; i < 20; i++) {
      store.appendSessionSample("multi-win", { tokens: 100, cost: 0.001, agents: 1, context: 30 });
    }

    // Then all three window buffers have data for the session
    const buf1m = store.getSessionWindowBuffer("multi-win", "tokens", "1m");
    const buf5m = store.getSessionWindowBuffer("multi-win", "tokens", "5m");
    const buf15m = store.getSessionWindowBuffer("multi-win", "tokens", "15m");

    expect(buf1m).toBeDefined();
    expect(buf1m!.samples.length).toBeGreaterThan(0);
    expect(buf5m).toBeDefined();
    expect(buf5m!.samples.length).toBeGreaterThan(0);
    expect(buf15m).toBeDefined();
    expect(buf15m!.samples.length).toBeGreaterThan(0);
  });

  it("existing getAggregateBuffer and getSessionBuffer continue to work", () => {
    // Given a store with sessions and samples (backward compatibility)
    const store = createMultiSessionStore();
    store.addSession("compat");
    store.appendSessionSample("compat", { tokens: 250, cost: 0.002, agents: 1, context: 45 });

    // When the legacy getters are called
    const aggBuffer = store.getAggregateBuffer("tokens");
    const sessBuffer = store.getSessionBuffer("compat", "tokens");

    // Then they still return valid buffers with data
    expect(aggBuffer).toBeDefined();
    expect(aggBuffer.samples.length).toBeGreaterThan(0);
    expect(sessBuffer).toBeDefined();
    expect(sessBuffer!.samples.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: US-PMR-03 "all windows accumulate independently"
// ---------------------------------------------------------------------------

describe("@property: 1m window always has at least as many samples as 5m for same input", () => {
  it("1m sample count >= 5m sample count for any input sequence", () => {
    // Given varying durations of input data
    for (const eventCount of [10, 50, 200, 1000]) {
      let buffer = createMultiWindowBuffer();
      for (let i = 0; i < eventCount; i++) {
        buffer = appendMultiWindowSample(buffer, sample(i * 100, 300));
      }

      const samples1m = getActiveWindowSamples(buffer, "1m");
      const samples5m = getActiveWindowSamples(buffer, "5m");

      // Then the higher-resolution window always has at least as many samples
      expect(samples1m.length).toBeGreaterThanOrEqual(samples5m.length);
    }
  });
});

describe("@property: window buffer capacity is never exceeded", () => {
  it("no window exceeds its configured capacity regardless of input volume", () => {
    // Given a very long input stream (10 minutes at 100ms = 6000 events)
    let buffer = createMultiWindowBuffer();
    for (let i = 0; i < 6000; i++) {
      buffer = appendMultiWindowSample(buffer, sample(i * 100, 250));
    }

    // Then each window respects its capacity limit
    for (const preset of TIME_WINDOW_PRESETS) {
      const samples = getActiveWindowSamples(buffer, preset.label as "1m" | "5m" | "15m");
      expect(samples.length).toBeLessThanOrEqual(preset.bufferCapacity);
    }
  });
});
