/**
 * Acceptance tests: Chart Renderer Pure Functions (v2)
 *
 * Validates the filled-area line chart renderer: hit-test computation,
 * sparkline data preparation, horizontal grid lines, Y-axis labels,
 * and crosshair positioning. All functions are pure -- canvas context
 * passed as parameter, no side effects.
 *
 * Driving ports: chartRenderer module (new v2 domain module)
 * Reuses: oscilloscope.ts (prepareWaveformPoints, computeCanvasDimensions)
 *
 * Traces to: Design spec Section 2 "The Main Graph", Section 6 "Sparklines",
 * ADR-010 "Canvas Hover Tooltip Architecture", architecture-design.md
 */

import { describe, it, expect } from "vitest";

// Driving port: chartRenderer (new v2 domain module)
// These imports will resolve once the module is implemented.
import {
  computeHitTest,
  prepareHorizontalGridLines,
  prepareFilledAreaPoints,
  prepareSparklinePoints,
  computeCrosshairPosition,
  formatTimeOffset,
  type HitTestResult,
  type HorizontalGridLine,
  type FilledAreaPoint,
} from "../../../src/plugins/norbert-usage/domain/chartRenderer";

import type { CanvasDimensions } from "../../../src/plugins/norbert-usage/domain/oscilloscope";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STANDARD_DIMENSIONS: CanvasDimensions = {
  width: 400,
  height: 200,
  padding: 10,
};

const SPARKLINE_DIMENSIONS: CanvasDimensions = {
  width: 80,
  height: 20,
  padding: 0,
};

// Create simple value-only samples for chart tests
const createSamples = (values: ReadonlyArray<number>): ReadonlyArray<{ timestamp: number; value: number }> =>
  values.map((value, index) => ({
    timestamp: Date.now() - (values.length - 1 - index) * 1000,
    value,
  }));

// ---------------------------------------------------------------------------
// WALKING SKELETON: User hovers over a chart and sees the data point value
// Traces to: ADR-010, Design spec Section 2 "Hover Tooltips"
// ---------------------------------------------------------------------------

describe("User hovers over chart point and sees value with time offset", () => {
  it("mouse position maps to nearest sample index with formatted value", () => {
    // Given a chart with 60 samples spanning 60 seconds
    const samples = createSamples(Array.from({ length: 60 }, (_, i) => 100 + i * 10));
    const canvasWidth = 400;
    const bufferLength = 60;

    // When the user hovers at the midpoint of the chart (x=200)
    const mouseX = 200;
    const result = computeHitTest(mouseX, canvasWidth, bufferLength, STANDARD_DIMENSIONS.padding);

    // Then the hit test returns the sample index nearest to the midpoint
    expect(result.sampleIndex).toBeGreaterThanOrEqual(28);
    expect(result.sampleIndex).toBeLessThanOrEqual(31);
    // And the index is within valid bounds
    expect(result.sampleIndex).toBeGreaterThanOrEqual(0);
    expect(result.sampleIndex).toBeLessThan(bufferLength);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Hit-Test Computation
// Traces to: ADR-010 "Hit-test computation", architecture "O(1) lookup"
// ---------------------------------------------------------------------------

describe("Hit-test at left edge maps to first sample", () => {
  it("mouse at left padding maps to sample index 0", () => {
    // Given a chart with 60 samples
    const padding = 10;

    // When the mouse is at the left edge (x = padding)
    const result = computeHitTest(padding, 400, 60, padding);

    // Then the sample index is 0
    expect(result.sampleIndex).toBe(0);
  });
});

describe("Hit-test at right edge maps to last sample", () => {
  it("mouse at right edge maps to the last sample index", () => {
    // Given a chart with 60 samples
    const canvasWidth = 400;
    const padding = 10;

    // When the mouse is at the right edge (x = width - padding)
    const result = computeHitTest(canvasWidth - padding, canvasWidth, 60, padding);

    // Then the sample index is the last (59)
    expect(result.sampleIndex).toBe(59);
  });
});

describe("Hit-test outside canvas bounds is clamped", () => {
  it("mouse beyond right edge clamps to last sample", () => {
    // Given a chart with 60 samples
    // When the mouse is beyond the right edge (x = 500 on a 400px canvas)
    const result = computeHitTest(500, 400, 60, 10);

    // Then the sample index is clamped to the last valid index
    expect(result.sampleIndex).toBe(59);
  });

  it("mouse before left edge clamps to first sample", () => {
    // Given a chart with 60 samples
    // When the mouse is before the left edge (x = -10)
    const result = computeHitTest(-10, 400, 60, 10);

    // Then the sample index is clamped to 0
    expect(result.sampleIndex).toBe(0);
  });
});

describe("Hit-test with single sample always returns index 0", () => {
  it("single-sample buffer maps any position to index 0", () => {
    // Given a chart with only 1 sample
    // When the mouse is at any position
    const result = computeHitTest(200, 400, 1, 10);

    // Then the sample index is 0
    expect(result.sampleIndex).toBe(0);
  });
});

describe("Hit-test with empty buffer returns negative index", () => {
  it("empty buffer indicates no valid hit", () => {
    // Given a chart with no samples
    // When hit-test is attempted
    const result = computeHitTest(200, 400, 0, 10);

    // Then the result indicates no valid hit
    expect(result.sampleIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Time Offset Formatting
// Traces to: Design spec Section 2 "Time offset: displayed as seconds ago"
// ---------------------------------------------------------------------------

describe("Time offset formatted as seconds ago", () => {
  it("recent sample shows '1s ago'", () => {
    // Given a sample from 1 second ago
    const offset = formatTimeOffset(1000);

    // Then it shows "1s ago"
    expect(offset).toBe("1s ago");
  });

  it("older sample shows seconds offset", () => {
    // Given a sample from 23 seconds ago
    const offset = formatTimeOffset(23000);

    // Then it shows "23s ago"
    expect(offset).toBe("23s ago");
  });

  it("most recent sample shows '0s ago'", () => {
    // Given the most recent sample (0ms offset)
    const offset = formatTimeOffset(0);

    // Then it shows "0s ago"
    expect(offset).toBe("0s ago");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Horizontal Grid Lines
// Traces to: Design spec Section 2 "Grid lines: subtle horizontal lines"
// ---------------------------------------------------------------------------

describe("Horizontal grid lines positioned at Y-axis intervals", () => {
  it("grid lines placed at major intervals for tokens category", () => {
    // Given a chart area for the tokens category with yMax of 1000
    const yMax = 1000;
    const yLabels = ["0", "250", "500", "750", "1k"];

    // When horizontal grid lines are computed
    const gridLines = prepareHorizontalGridLines(
      STANDARD_DIMENSIONS,
      yLabels,
    );

    // Then grid lines are positioned at the Y-axis intervals
    expect(gridLines.length).toBe(yLabels.length);
    // And each grid line has a label and y-position
    expect(gridLines[0]).toHaveProperty("y");
    expect(gridLines[0]).toHaveProperty("label");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Filled-Area Points
// Traces to: Design spec Section 2 "Line chart with filled area beneath"
// ---------------------------------------------------------------------------

describe("Filled-area chart produces line points with baseline", () => {
  it("points mapped from values to canvas coordinates with bottom baseline", () => {
    // Given 5 samples with values [10, 50, 30, 80, 60]
    const samples = createSamples([10, 50, 30, 80, 60]);

    // When filled-area points are prepared
    const points = prepareFilledAreaPoints(samples, STANDARD_DIMENSIONS, 100);

    // Then the number of line points matches the sample count
    expect(points).toHaveLength(5);
    // And the highest value (80) maps closest to the top
    const yValues = points.map((p) => p.y);
    const minY = Math.min(...yValues); // highest value = lowest y (canvas inverted)
    expect(points[3].y).toBe(minY);
  });
});

describe("Filled-area chart with all zero values produces flat baseline", () => {
  it("zero values map to the bottom of the chart area", () => {
    // Given 5 samples all at zero
    const samples = createSamples([0, 0, 0, 0, 0]);

    // When filled-area points are prepared
    const points = prepareFilledAreaPoints(samples, STANDARD_DIMENSIONS, 100);

    // Then all points are at the bottom of the chart area (height - padding)
    const bottomY = STANDARD_DIMENSIONS.height - STANDARD_DIMENSIONS.padding;
    for (const point of points) {
      expect(point.y).toBe(bottomY);
    }
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Sparkline Points
// Traces to: Design spec Section 6 "Sidebar Mini-Sparklines"
// ---------------------------------------------------------------------------

describe("Sparkline produces line-only points without grid or labels", () => {
  it("sparkline maps values to compact canvas coordinates", () => {
    // Given 60 samples for a 60-second sparkline
    const samples = createSamples(Array.from({ length: 60 }, (_, i) => Math.sin(i / 5) * 50 + 50));

    // When sparkline points are prepared
    const points = prepareSparklinePoints(samples, SPARKLINE_DIMENSIONS, 100);

    // Then 60 points are produced
    expect(points).toHaveLength(60);
    // And x coordinates span the full width
    expect(points[0].x).toBe(0);
    expect(points[59].x).toBe(SPARKLINE_DIMENSIONS.width);
  });
});

describe("Sparkline with empty samples produces no points", () => {
  it("empty buffer produces empty sparkline", () => {
    // Given no samples
    const samples: ReadonlyArray<{ timestamp: number; value: number }> = [];

    // When sparkline points are prepared
    const points = prepareSparklinePoints(samples, SPARKLINE_DIMENSIONS, 100);

    // Then no points are produced
    expect(points).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Crosshair Position
// Traces to: Design spec Section 2 "Crosshair rendering"
// ---------------------------------------------------------------------------

describe("Crosshair positioned at hovered sample", () => {
  it("crosshair x and dot y computed from sample index and value", () => {
    // Given a chart with 60 samples and the user hovering at index 30
    const sampleIndex = 30;
    const sampleValue = 75;
    const yMax = 100;

    // When crosshair position is computed
    const crosshair = computeCrosshairPosition(
      sampleIndex,
      sampleValue,
      60,
      yMax,
      STANDARD_DIMENSIONS,
    );

    // Then the crosshair x is approximately at the midpoint
    expect(crosshair.x).toBeGreaterThan(STANDARD_DIMENSIONS.padding);
    expect(crosshair.x).toBeLessThan(STANDARD_DIMENSIONS.width - STANDARD_DIMENSIONS.padding);
    // And the dot y reflects the value position
    expect(crosshair.dotY).toBeGreaterThan(STANDARD_DIMENSIONS.padding);
    expect(crosshair.dotY).toBeLessThan(STANDARD_DIMENSIONS.height - STANDARD_DIMENSIONS.padding);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Edge Cases
// ---------------------------------------------------------------------------

describe("Chart renderer handles zero yMax gracefully", () => {
  it("zero yMax produces flat baseline without division errors", () => {
    // Given samples with a yMax of 0 (all values are zero)
    const samples = createSamples([0, 0, 0]);

    // When filled-area points are prepared with yMax=0
    const points = prepareFilledAreaPoints(samples, STANDARD_DIMENSIONS, 0);

    // Then points are produced without NaN or Infinity
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe("Chart renderer handles negative mouse coordinates", () => {
  it("negative mouseX clamps to first sample", () => {
    // Given negative mouse position
    const result = computeHitTest(-50, 400, 60, 10);

    // Then sample index is clamped to 0
    expect(result.sampleIndex).toBe(0);
  });
});

describe("Filled-area chart handles single sample without crashing", () => {
  it("single sample produces one point at the canvas origin", () => {
    // Given a chart with exactly 1 sample
    const samples = createSamples([42]);

    // When filled-area points are prepared
    const points = prepareFilledAreaPoints(samples, STANDARD_DIMENSIONS, 100);

    // Then exactly 1 point is produced
    expect(points).toHaveLength(1);
    expect(Number.isFinite(points[0].x)).toBe(true);
    expect(Number.isFinite(points[0].y)).toBe(true);
  });
});

describe("Horizontal grid lines with zero yMax produces no grid lines", () => {
  it("zero yMax means no intervals to draw", () => {
    // Given a yMax of 0 and empty labels
    const gridLines = prepareHorizontalGridLines(STANDARD_DIMENSIONS, []);

    // Then no grid lines are produced
    expect(gridLines).toHaveLength(0);
  });
});

describe("Time offset for large values formats correctly", () => {
  it("120 seconds shows '120s ago'", () => {
    // Given a sample from 120 seconds ago
    const offset = formatTimeOffset(120000);

    // Then it shows "120s ago" (no minute conversion)
    expect(offset).toBe("120s ago");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: Architecture "Testability" -- hit-test O(1) correctness
// ---------------------------------------------------------------------------

describe("@property: hit-test index is always within buffer bounds", () => {
  it("for any mouseX within canvas width, index is in [0, bufferLength-1]", () => {
    // Given a buffer of 60 samples and canvas width of 400
    const bufferLength = 60;
    const canvasWidth = 400;

    // When hit-test is computed at various positions across the canvas
    const positions = [0, 50, 100, 150, 200, 250, 300, 350, 400];
    for (const mouseX of positions) {
      const result = computeHitTest(mouseX, canvasWidth, bufferLength, 10);

      // Then the index is within valid bounds
      expect(result.sampleIndex).toBeGreaterThanOrEqual(0);
      expect(result.sampleIndex).toBeLessThan(bufferLength);
    }
  });
});
