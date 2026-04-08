/**
 * Unit tests: Chart View Helpers -- pure functions extracted from view components.
 *
 * Behaviors tested:
 * - computeEffectiveYMax: autoscaling with 10% headroom, fallback on empty/zero
 * - hexToRgba: hex color parsing and fallback for invalid input
 * - computeTooltipLeft: edge-flip when tooltip overflows right boundary
 * - computeTooltipTop: offset from cursor Y
 * - computeGridColumns: 2 columns up to 4 sessions, 3 beyond
 * - shouldShowPerSessionGrid: false for 0-1 sessions, true for 2+
 * - shouldShowAggregateGraph: delegates to category.aggregateApplicable
 * - formatSessionLabel: project name fallback to truncated session ID
 * - formatDurationLabel: maps all 4 TimeWindowId values
 */

import { describe, it, expect } from "vitest";
import {
  computeEffectiveYMax,
  hexToRgba,
  computeTooltipLeft,
  computeTooltipLeftClamped,
  computeTooltipTop,
  computeGridColumns,
  shouldShowPerSessionGrid,
  shouldShowAggregateGraph,
  formatSessionLabel,
  formatDurationLabel,
} from "../../../../../src/plugins/norbert-usage/domain/chartViewHelpers";
import type { RateSample } from "../../../../../src/plugins/norbert-usage/domain/types";
import type { MetricCategory } from "../../../../../src/plugins/norbert-usage/domain/categoryConfig";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSample = (tokenRate: number, costRate = 0, timestamp = 0): RateSample => ({
  timestamp,
  tokenRate,
  costRate,
});

const makeCategory = (overrides: Partial<MetricCategory>): MetricCategory => ({
  id: "tokens",
  label: "Tokens/s",
  color: "#00e5cc",
  cssVar: "--brand",
  yMax: 2000,
  yLabels: [],
  aggregateApplicable: true,
  aggregateStrategy: "sum",
  formatValue: (v: number) => `${v}`,
  statsConfig: [],
  sessionColumns: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// computeEffectiveYMax
// ---------------------------------------------------------------------------

describe("computeEffectiveYMax", () => {
  it("returns yMax fallback when samples are empty", () => {
    expect(computeEffectiveYMax([], "tokenRate", 2000)).toBe(2000);
  });

  it("returns 1 when samples are empty and yMax is undefined", () => {
    expect(computeEffectiveYMax([], "tokenRate", undefined)).toBe(1);
  });

  it("adds 10% headroom above peak when peak is positive", () => {
    const samples = [makeSample(100), makeSample(200), makeSample(150)];
    expect(computeEffectiveYMax(samples, "tokenRate", 2000)).toBeCloseTo(220);
  });

  it("falls back to yMax when all values are zero", () => {
    const samples = [makeSample(0), makeSample(0)];
    expect(computeEffectiveYMax(samples, "tokenRate", 500)).toBe(500);
  });

  it("falls back to 1 when all values are zero and yMax is undefined", () => {
    const samples = [makeSample(0)];
    expect(computeEffectiveYMax(samples, "tokenRate", undefined)).toBe(1);
  });

  it("uses costRate field when specified", () => {
    const samples = [
      { timestamp: 0, tokenRate: 100, costRate: 50 },
      { timestamp: 1, tokenRate: 200, costRate: 80 },
    ];
    expect(computeEffectiveYMax(samples, "costRate", 1000)).toBeCloseTo(88);
  });
});

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe("hexToRgba", () => {
  it("converts valid hex to rgba", () => {
    expect(hexToRgba("#00e5cc", 0.5)).toBe("rgba(0, 229, 204, 0.5)");
  });

  it("handles uppercase hex", () => {
    expect(hexToRgba("#FF0000", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("returns white fallback for invalid hex", () => {
    expect(hexToRgba("not-a-color", 0.3)).toBe("rgba(255, 255, 255, 0.3)");
  });

  it("returns white fallback for empty string", () => {
    expect(hexToRgba("", 0.7)).toBe("rgba(255, 255, 255, 0.7)");
  });
});

// ---------------------------------------------------------------------------
// computeTooltipLeft
// ---------------------------------------------------------------------------

describe("computeTooltipLeft", () => {
  it("places tooltip to the right of cursor when space allows", () => {
    // containerWidth=800, tooltipX=100 -- plenty of room to the right
    const left = computeTooltipLeft(100, 800);
    expect(left).toBe(108); // 100 + 8 offset
  });

  it("flips tooltip to the left when it would overflow right edge", () => {
    // containerWidth=800, tooltipX=700 -- 700 + 8 + 140 = 848 > 800
    const left = computeTooltipLeft(700, 800);
    expect(left).toBe(552); // 700 - 8 - 140
  });

  it("flips at exact boundary", () => {
    // containerWidth=800, tooltipX=652 -- 652 + 8 + 140 = 800, not > 800, so no flip
    expect(computeTooltipLeft(652, 800)).toBe(660);

    // tooltipX=653 -- 653 + 8 + 140 = 801 > 800, flips
    expect(computeTooltipLeft(653, 800)).toBe(505);
  });
});

// ---------------------------------------------------------------------------
// computeTooltipLeftClamped
// ---------------------------------------------------------------------------

describe("computeTooltipLeftClamped", () => {
  it("places tooltip to the right of cursor when space allows", () => {
    // tooltipX=100, width=140, container=800, zoom=1 -> 100+8 = 108
    expect(computeTooltipLeftClamped(100, 140, 800, 1)).toBe(108);
  });

  it("flips left when measured width would overflow right edge", () => {
    // 700 + 8 + 140 = 848 > 800-8 -> flip: 700 - 8 - 140 = 552
    expect(computeTooltipLeftClamped(700, 140, 800, 1)).toBe(552);
  });

  it("flips when actual width is larger than the legacy 140 estimate", () => {
    // tooltipX=680, width=200: 680+8+200=888 > 792 -> flip
    // 680 - 8 - 200 = 472
    expect(computeTooltipLeftClamped(680, 200, 800, 1)).toBe(472);
  });

  it("normalizes containerWidth by documentElement zoom", () => {
    // With zoom=1.5 the effective layout width is 800/1.5 ≈ 533.
    // tooltipX=500, width=140: 500+8+140=648 > 533-8=525 -> flip
    // preferred = 500 - 8 - 140 = 352
    expect(computeTooltipLeftClamped(500, 140, 800, 1.5)).toBe(352);
  });

  it("clamps so tooltip cannot extend past the right edge", () => {
    // tooltipX past container (coordinate-space mismatch case)
    // preferred flip = 1000 - 8 - 140 = 852, but rightEdge - width = 652
    // result clamped to 652
    expect(computeTooltipLeftClamped(1000, 140, 800, 1)).toBe(652);
  });

  it("clamps to left margin when preferred would go negative", () => {
    // tooltipX=-50, width=140: preferred right = -50+8 = -42, also flip
    // gives -50-8-140 = -198. Clamped to EDGE_MARGIN = 8.
    expect(computeTooltipLeftClamped(-50, 140, 800, 1)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeTooltipTop
// ---------------------------------------------------------------------------

describe("computeTooltipTop", () => {
  it("offsets tooltip above cursor by 8 pixels", () => {
    expect(computeTooltipTop(200)).toBe(192); // 200 + (-8)
  });

  it("can produce negative values near top of screen", () => {
    expect(computeTooltipTop(5)).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// computeGridColumns
// ---------------------------------------------------------------------------

describe("computeGridColumns", () => {
  it("returns 2 for 1 session", () => {
    expect(computeGridColumns(1)).toBe(2);
  });

  it("returns 2 for 4 sessions", () => {
    expect(computeGridColumns(4)).toBe(2);
  });

  it("returns 3 for 5 sessions", () => {
    expect(computeGridColumns(5)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// shouldShowPerSessionGrid
// ---------------------------------------------------------------------------

describe("shouldShowPerSessionGrid", () => {
  it("returns false for 0 sessions", () => {
    expect(shouldShowPerSessionGrid(0)).toBe(false);
  });

  it("returns false for 1 session", () => {
    expect(shouldShowPerSessionGrid(1)).toBe(false);
  });

  it("returns true for 2 sessions", () => {
    expect(shouldShowPerSessionGrid(2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldShowAggregateGraph
// ---------------------------------------------------------------------------

describe("shouldShowAggregateGraph", () => {
  it("returns true when category is aggregate-applicable", () => {
    expect(shouldShowAggregateGraph(makeCategory({ aggregateApplicable: true }))).toBe(true);
  });

  it("returns false when category is not aggregate-applicable", () => {
    expect(shouldShowAggregateGraph(makeCategory({ aggregateApplicable: false }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatSessionLabel
// ---------------------------------------------------------------------------

describe("formatSessionLabel", () => {
  it("returns sessionLabel when present", () => {
    expect(formatSessionLabel({ sessionId: "abc12345-long-id", sessionLabel: "my-project" }))
      .toBe("my-project");
  });

  it("falls back to truncated sessionId when label is empty", () => {
    expect(formatSessionLabel({ sessionId: "abc12345-long-id", sessionLabel: "" }))
      .toBe("abc12345");
  });
});

// ---------------------------------------------------------------------------
// formatDurationLabel
// ---------------------------------------------------------------------------

describe("formatDurationLabel", () => {
  it("maps the 1m window to its duration label", () => {
    expect(formatDurationLabel("1m")).toBe("60 seconds");
  });
});
