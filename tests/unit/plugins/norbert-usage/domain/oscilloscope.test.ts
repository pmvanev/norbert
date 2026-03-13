/**
 * Unit tests: Oscilloscope Waveform Data Preparation (Step 05-01)
 *
 * Pure functions for preparing time-series buffer data for canvas rendering:
 * - prepareWaveformPoints: map RateSamples to canvas x,y coordinates
 * - computeGridLines: compute vertical grid line x-positions at time intervals
 * - formatRateOverlay: format current token rate for text overlay display
 *
 * Behaviors: 6 (waveform mapping, normalization bounds, empty buffer,
 *               grid line spacing, grid line count, rate formatting)
 * Test budget: max 12 tests
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  prepareWaveformPoints,
  computeGridLines,
  formatRateOverlay,
  type WaveformPoint,
  type CanvasDimensions,
  type GridLine,
} from "../../../../../src/plugins/norbert-usage/domain/oscilloscope";
import type { RateSample } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const rateSampleArb = (timestamp: number): fc.Arbitrary<RateSample> =>
  fc.record({
    timestamp: fc.constant(timestamp),
    tokenRate: fc.integer({ min: 0, max: 2000 }),
    costRate: fc.double({ min: 0, max: 1, noNaN: true }),
  });

const canvasDimensionsArb: fc.Arbitrary<CanvasDimensions> = fc.record({
  width: fc.integer({ min: 100, max: 2000 }),
  height: fc.integer({ min: 50, max: 1000 }),
  padding: fc.integer({ min: 0, max: 20 }),
});

// ---------------------------------------------------------------------------
// prepareWaveformPoints
// ---------------------------------------------------------------------------

describe("Oscilloscope waveform point preparation", () => {
  it("maps each sample to a canvas coordinate within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        canvasDimensionsArb,
        (sampleCount, dimensions) => {
          const samples: ReadonlyArray<RateSample> = Array.from(
            { length: sampleCount },
            (_, i) => ({
              timestamp: i * 100,
              tokenRate: Math.floor(Math.random() * 500),
              costRate: Math.random() * 0.1,
            }),
          );

          const points = prepareWaveformPoints(
            samples,
            dimensions,
            "tokenRate",
          );

          expect(points).toHaveLength(sampleCount);

          for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(dimensions.padding);
            expect(point.x).toBeLessThanOrEqual(
              dimensions.width - dimensions.padding,
            );
            expect(point.y).toBeGreaterThanOrEqual(dimensions.padding);
            expect(point.y).toBeLessThanOrEqual(
              dimensions.height - dimensions.padding,
            );
          }
        },
      ),
    );
  });

  it("returns empty array for empty samples", () => {
    const dimensions: CanvasDimensions = {
      width: 400,
      height: 200,
      padding: 10,
    };
    const points = prepareWaveformPoints([], dimensions, "tokenRate");
    expect(points).toHaveLength(0);
  });

  it("normalizes peak value to top of canvas (minimum y)", () => {
    const dimensions: CanvasDimensions = {
      width: 400,
      height: 200,
      padding: 10,
    };
    const samples: ReadonlyArray<RateSample> = [
      { timestamp: 0, tokenRate: 0, costRate: 0 },
      { timestamp: 100, tokenRate: 500, costRate: 0 },
      { timestamp: 200, tokenRate: 250, costRate: 0 },
    ];

    const points = prepareWaveformPoints(samples, dimensions, "tokenRate");

    // The peak sample (500) should be at the top (padding y)
    expect(points[1].y).toBe(dimensions.padding);
    // Zero rate should be at bottom (height - padding)
    expect(points[0].y).toBe(dimensions.height - dimensions.padding);
  });

  it("distributes x coordinates evenly across canvas width", () => {
    const dimensions: CanvasDimensions = {
      width: 400,
      height: 200,
      padding: 0,
    };
    const samples: ReadonlyArray<RateSample> = [
      { timestamp: 0, tokenRate: 100, costRate: 0 },
      { timestamp: 100, tokenRate: 200, costRate: 0 },
      { timestamp: 200, tokenRate: 300, costRate: 0 },
    ];

    const points = prepareWaveformPoints(samples, dimensions, "tokenRate");

    // First point at left edge, last at right edge
    expect(points[0].x).toBe(0);
    expect(points[2].x).toBe(400);
    // Middle point at center
    expect(points[1].x).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// computeGridLines
// ---------------------------------------------------------------------------

describe("Oscilloscope grid line computation", () => {
  it("produces grid lines at regular time intervals", () => {
    const dimensions: CanvasDimensions = {
      width: 600,
      height: 200,
      padding: 0,
    };
    // 60 seconds of samples at 10Hz = 600 samples
    const windowDurationMs = 60_000;
    const intervalMs = 10_000; // grid line every 10 seconds

    const gridLines = computeGridLines(
      dimensions,
      windowDurationMs,
      intervalMs,
    );

    // 60s / 10s = 6 intervals, so 5 internal grid lines (excluding edges)
    expect(gridLines).toHaveLength(5);

    // Each grid line x should be within canvas bounds
    for (const line of gridLines) {
      expect(line.x).toBeGreaterThan(0);
      expect(line.x).toBeLessThan(dimensions.width);
    }
  });

  it("labels grid lines with time offset in seconds", () => {
    const dimensions: CanvasDimensions = {
      width: 600,
      height: 200,
      padding: 0,
    };
    const gridLines = computeGridLines(dimensions, 60_000, 10_000);

    // Grid labels should show seconds offset (e.g., "-50s", "-40s", etc.)
    expect(gridLines[0].label).toBe("-50s");
    expect(gridLines[4].label).toBe("-10s");
  });
});

// ---------------------------------------------------------------------------
// formatRateOverlay
// ---------------------------------------------------------------------------

describe("Oscilloscope rate overlay formatting", () => {
  it("formats zero rate as '0 tok/s'", () => {
    expect(formatRateOverlay(0)).toBe("0 tok/s");
  });

  it("formats integer rates without decimals", () => {
    expect(formatRateOverlay(500)).toBe("500 tok/s");
  });

  it("formats rates >= 1000 with 'k' suffix", () => {
    expect(formatRateOverlay(1500)).toBe("1.5k tok/s");
    expect(formatRateOverlay(2000)).toBe("2.0k tok/s");
  });

  it("always includes 'tok/s' unit suffix", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        (rate) => {
          const formatted = formatRateOverlay(rate);
          expect(formatted).toMatch(/tok\/s$/);
        },
      ),
    );
  });
});
