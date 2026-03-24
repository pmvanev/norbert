import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  formatActiveTime,
  formatDuration,
  EMPTY_ACTIVE_TIME,
  type AccumulatedMetric,
} from "./activeTimeFormatter";

// ---------------------------------------------------------------------------
// Helpers: metric builders
// ---------------------------------------------------------------------------

const buildMetric = (
  metricName: string,
  attributeKey: string,
  value: number,
): AccumulatedMetric => ({
  metricName,
  attributeKey,
  value,
});

const buildActiveTimeMetrics = (
  userSeconds: number,
  cliSeconds: number,
): ReadonlyArray<AccumulatedMetric> => [
  buildMetric("active_time.total", "type=user", userSeconds),
  buildMetric("active_time.total", "type=cli", cliSeconds),
];

// ---------------------------------------------------------------------------
// Arbitrary: AccumulatedMetric for active_time
// ---------------------------------------------------------------------------

const activeTimeMetricsArb = fc
  .tuple(
    fc.integer({ min: 0, max: 360000 }),
    fc.integer({ min: 0, max: 360000 }),
  )
  .map(([user, cli]) => buildActiveTimeMetrics(user, cli));

// ---------------------------------------------------------------------------
// Acceptance: active time with known values
// ---------------------------------------------------------------------------

describe("formatActiveTime", () => {
  it("returns correct split for user=3600 + cli=1800", () => {
    const metrics = buildActiveTimeMetrics(3600, 1800);
    const result = formatActiveTime(metrics);

    expect(result.userSeconds).toBe(3600);
    expect(result.cliSeconds).toBe(1800);
    expect(result.totalSeconds).toBe(5400);
    expect(result.userPercent).toBeCloseTo(66.67, 1);
    expect(result.cliPercent).toBeCloseTo(33.33, 1);
    expect(result.userFormatted).toBe("1h 0m");
    expect(result.cliFormatted).toBe("30m 0s");
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("returns empty summary for empty metrics array", () => {
    const result = formatActiveTime([]);
    expect(result).toEqual(EMPTY_ACTIVE_TIME);
  });

  it("returns empty summary when no active_time metrics present", () => {
    const metrics = [buildMetric("cost.usage", "model=opus", 2.47)];
    const result = formatActiveTime(metrics);
    expect(result).toEqual(EMPTY_ACTIVE_TIME);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it("handles user-only time (cli=0)", () => {
    const metrics = buildActiveTimeMetrics(120, 0);
    const result = formatActiveTime(metrics);

    expect(result.userPercent).toBe(100);
    expect(result.cliPercent).toBe(0);
    expect(result.userFormatted).toBe("2m 0s");
    expect(result.cliFormatted).toBe("0s");
  });

  it("handles cli-only time (user=0)", () => {
    const metrics = buildActiveTimeMetrics(0, 300);
    const result = formatActiveTime(metrics);

    expect(result.userPercent).toBe(0);
    expect(result.cliPercent).toBe(100);
    expect(result.cliFormatted).toBe("5m 0s");
  });

  // -------------------------------------------------------------------------
  // Property: percentages sum to 100 (when total > 0)
  // -------------------------------------------------------------------------

  it("property: percentages sum to 100 when total > 0", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 360000 }),
          fc.integer({ min: 0, max: 360000 }),
        ),
        ([user, cli]) => {
          const metrics = buildActiveTimeMetrics(user, cli);
          const result = formatActiveTime(metrics);
          if (result.totalSeconds > 0) {
            expect(result.userPercent + result.cliPercent).toBeCloseTo(100, 1);
          }
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property: totalSeconds equals userSeconds + cliSeconds
  // -------------------------------------------------------------------------

  it("property: totalSeconds equals userSeconds + cliSeconds", () => {
    fc.assert(
      fc.property(activeTimeMetricsArb, (metrics) => {
        const result = formatActiveTime(metrics);
        expect(result.totalSeconds).toBe(result.userSeconds + result.cliSeconds);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: all time values are non-negative
  // -------------------------------------------------------------------------

  it("property: all time values are non-negative", () => {
    fc.assert(
      fc.property(activeTimeMetricsArb, (metrics) => {
        const result = formatActiveTime(metrics);
        expect(result.userSeconds).toBeGreaterThanOrEqual(0);
        expect(result.cliSeconds).toBeGreaterThanOrEqual(0);
        expect(result.totalSeconds).toBeGreaterThanOrEqual(0);
        expect(result.userPercent).toBeGreaterThanOrEqual(0);
        expect(result.cliPercent).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// formatDuration (pure helper)
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("formats 0 seconds as '0s'", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3661)).toBe("1h 1m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(7200)).toBe("2h 0m");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(300)).toBe("5m 0s");
  });

  // -------------------------------------------------------------------------
  // Property: formatted string is non-empty for any non-negative input
  // -------------------------------------------------------------------------

  it("property: output is non-empty for non-negative seconds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 360000 }), (seconds) => {
        const result = formatDuration(seconds);
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });
});
