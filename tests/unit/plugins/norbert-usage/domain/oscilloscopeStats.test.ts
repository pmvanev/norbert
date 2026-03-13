/**
 * Unit tests: Oscilloscope Stats Bar Formatting (Step 05-02)
 *
 * Pure functions for formatting OscilloscopeStats into display strings:
 * - formatTokenCount: comma-separated integer display
 * - formatWindowDuration: milliseconds to "Xs" display
 * - formatStatsBar: compose stats into display-ready structure
 *
 * Behaviors: 3 (token count formatting, window duration, stats bar composition)
 * Test budget: max 6 tests
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  formatTokenCount,
  formatWindowDuration,
  formatStatsBar,
  type StatsBarDisplay,
} from "../../../../../src/plugins/norbert-usage/domain/oscilloscope";
import type { OscilloscopeStats } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// formatTokenCount
// ---------------------------------------------------------------------------

describe("Stats bar token count formatting", () => {
  it("formats integers with comma thousand separators", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1000)).toBe("1,000");
    expect(formatTokenCount(87241)).toBe("87,241");
    expect(formatTokenCount(1234567)).toBe("1,234,567");
  });

  it("always produces string without decimals for non-negative integers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (count) => {
          const formatted = formatTokenCount(count);
          // Must not contain a decimal point
          expect(formatted).not.toContain(".");
          // Must only contain digits and commas
          expect(formatted).toMatch(/^[\d,]+$/);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// formatWindowDuration
// ---------------------------------------------------------------------------

describe("Stats bar window duration formatting", () => {
  it("converts milliseconds to seconds display", () => {
    expect(formatWindowDuration(0)).toBe("0s");
    expect(formatWindowDuration(60000)).toBe("60s");
    expect(formatWindowDuration(4000)).toBe("4s");
    expect(formatWindowDuration(59900)).toBe("60s");
  });
});

// ---------------------------------------------------------------------------
// formatStatsBar
// ---------------------------------------------------------------------------

describe("Stats bar composition from OscilloscopeStats", () => {
  it("composes zero stats into all-zero display", () => {
    const zeroStats: OscilloscopeStats = {
      peakRate: 0,
      avgRate: 0,
      totalTokens: 0,
      windowDuration: 0,
    };

    const display = formatStatsBar(zeroStats);

    expect(display.peakRate).toBe("0 tok/s");
    expect(display.avgRate).toBe("0 tok/s");
    expect(display.totalTokens).toBe("0");
    expect(display.windowDuration).toBe("0s");
  });

  it("composes non-zero stats into formatted display strings", () => {
    const stats: OscilloscopeStats = {
      peakRate: 512,
      avgRate: 327,
      totalTokens: 87241,
      windowDuration: 60000,
    };

    const display = formatStatsBar(stats);

    expect(display.peakRate).toBe("512 tok/s");
    expect(display.avgRate).toBe("327 tok/s");
    expect(display.totalTokens).toBe("87,241");
    expect(display.windowDuration).toBe("60s");
  });
});
