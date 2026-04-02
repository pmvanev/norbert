/**
 * Acceptance tests: Hover Time Offset Per Window
 *
 * Validates that hover tooltip time offset calculation uses the correct
 * sample interval for each time window, not a hardcoded 1000ms.
 *
 * Bug: PMChart.tsx computes timeOffsetMs as
 *   (chartSamples.length - 1 - sampleIndex) * 1000
 * which assumes 1 sample per second. But the 1m window uses 100ms intervals,
 * the 5m window uses 500ms, and the 15m window uses 1000ms.
 *
 * Traces to: performance-monitor-design-spec.md "Hover Tooltips",
 *            multiWindowSampler.ts TIME_WINDOW_PRESETS
 */

import { describe, it, expect } from "vitest";

import { TIME_WINDOW_PRESETS } from "../../../src/plugins/norbert-usage/domain/multiWindowSampler";

// ---------------------------------------------------------------------------
// Pure function under test: compute time offset from sample index
// ---------------------------------------------------------------------------

/**
 * Current (buggy) implementation from PMChart.tsx:349
 *   timeOffsetMs = (chartSamples.length - 1 - sampleIndex) * 1000
 *
 * Correct implementation should be:
 *   timeOffsetMs = (chartSamples.length - 1 - sampleIndex) * sampleIntervalMs
 */
const computeHoverTimeOffsetMs = (
  sampleCount: number,
  sampleIndex: number,
  sampleIntervalMs: number,
): number =>
  (sampleCount - 1 - sampleIndex) * sampleIntervalMs;

// ---------------------------------------------------------------------------
// Lookup sample interval for a given window
// ---------------------------------------------------------------------------

const getSampleIntervalMs = (windowLabel: string): number => {
  const preset = TIME_WINDOW_PRESETS.find((p) => p.label === windowLabel);
  return preset?.sampleIntervalMs ?? 1000;
};

// ---------------------------------------------------------------------------
// 1-MINUTE WINDOW: 100ms intervals
// ---------------------------------------------------------------------------

describe("Hover time offset uses 100ms interval for 1m window", () => {
  it("hovering 10 samples from the right edge in 1m window shows 1s ago, not 10s ago", () => {
    // Given a 1m window buffer with 600 samples at 100ms intervals
    const sampleCount = 600;
    const intervalMs = getSampleIntervalMs("1m");
    const sampleIndex = 589; // 10 samples back from index 599

    // When the time offset is computed
    const offsetMs = computeHoverTimeOffsetMs(sampleCount, sampleIndex, intervalMs);

    // Then the offset should be (599-589) * 100ms = 1000ms (1 second)
    expect(offsetMs).toBe(1000);
    // NOT 10 * 1000ms = 10000ms (10 seconds) as the buggy code produces
    expect(offsetMs).not.toBe(10000);
  });

  it("hovering at the leftmost sample in 1m window shows 59.9s ago", () => {
    // Given a full 1m window buffer
    const sampleCount = 600;
    const intervalMs = getSampleIntervalMs("1m");
    const sampleIndex = 0; // leftmost sample

    // When the time offset is computed
    const offsetMs = computeHoverTimeOffsetMs(sampleCount, sampleIndex, intervalMs);

    // Then the offset should be 599 * 100ms = 59900ms (~59.9 seconds)
    expect(offsetMs).toBe(59900);
  });
});

// ---------------------------------------------------------------------------
// 5-MINUTE WINDOW: 500ms intervals
// ---------------------------------------------------------------------------

describe("Hover time offset uses 500ms interval for 5m window", () => {
  it("hovering 10 samples from the right edge in 5m window shows 5s ago", () => {
    // Given a 5m window buffer with 600 samples at 500ms intervals
    const sampleCount = 600;
    const intervalMs = getSampleIntervalMs("5m");
    const sampleIndex = 589; // 10 samples back from index 599

    // When the time offset is computed
    const offsetMs = computeHoverTimeOffsetMs(sampleCount, sampleIndex, intervalMs);

    // Then the offset should be (599-589) * 500ms = 5000ms (5 seconds)
    expect(offsetMs).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// 15-MINUTE WINDOW: 1000ms intervals (matches current hardcoded assumption)
// ---------------------------------------------------------------------------

describe("Hover time offset uses 1000ms interval for 15m window", () => {
  it("hovering 10 samples from the right edge in 15m window shows 10s ago", () => {
    // Given a 15m window buffer with 900 samples at 1000ms intervals
    const sampleCount = 900;
    const intervalMs = getSampleIntervalMs("15m");
    const sampleIndex = 889; // 10 samples back from index 899

    // When the time offset is computed
    const offsetMs = computeHoverTimeOffsetMs(sampleCount, sampleIndex, intervalMs);

    // Then the offset should be (899-889) * 1000ms = 10000ms (10 seconds)
    // This window happens to match the current hardcoded 1000ms
    expect(offsetMs).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: sample interval from TIME_WINDOW_PRESETS is consistent
// ---------------------------------------------------------------------------

describe("@property: each window preset has a consistent sample interval", () => {
  it("1m interval is 100ms", () => {
    expect(getSampleIntervalMs("1m")).toBe(100);
  });

  it("5m interval is 500ms", () => {
    expect(getSampleIntervalMs("5m")).toBe(500);
  });

  it("15m interval is 1000ms", () => {
    expect(getSampleIntervalMs("15m")).toBe(1000);
  });
});
