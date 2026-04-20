/**
 * Unit tests: stepPolyline — pure step-function polyline generator for the
 * phosphor scope's square-wave trace rendering.
 *
 * The phosphor scope renders traces as sample-and-hold (staircase) rather
 * than diagonally connecting samples. Each sample holds its value from its
 * own timestamp until the next sample's timestamp, then the trace steps
 * vertically to the new value. After the last sample, the trace holds its
 * last value out to the right edge (x = width) so the current value is
 * visible at the scope's leading edge.
 *
 * `stepPolyline` produces the ordered point sequence a canvas walks to
 * draw that shape. The first point is a `moveTo`; every subsequent point
 * is a `lineTo`. The shape is:
 *
 *   (x0, y0)                      ← moveTo — first sample
 *   (x1, y0) (x1, y1)             ← hold y0 to x1, step to y1
 *   (x2, y1) (x2, y2)             ← hold y1 to x2, step to y2
 *   ...
 *   (xN-1, yN-2) (xN-1, yN-1)     ← hold to last sample's x, step to its y
 *   (width, yN-1)                 ← hold last value out to right edge
 *
 * Point count: 1 + 2*(N-1) + 1 = 2N for N samples. The helper is only
 * meaningful for N >= 2; fewer samples returns an empty array (matches the
 * renderer's `samples.length < 2` early return — a single-sample trace has
 * no step to draw).
 *
 * Properties under test:
 *   1. Point count is exactly 2N for N >= 2 samples; empty for N < 2.
 *   2. First point's x equals timeToX(samples[0].t) and y equals
 *      valueToY(samples[0].v).
 *   3. Last point's x equals the canvas right edge (width) and y equals
 *      valueToY(samples[N-1].v).
 *   4. Every adjacent pair of points changes EITHER x (horizontal hold)
 *      OR y (vertical step), never both — the staircase has no diagonals.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`.
 * Depends only on `canvasGeometry` (shared projection math).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { stepPolyline } from "./stepPolyline";
import { timeToX, valueToY } from "./canvasGeometry";
import type { RateSample } from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a non-empty sequence of RateSamples with strictly-increasing `t`
 * and non-negative `v`. The phosphor store guarantees these invariants;
 * properties that depend on them would otherwise need to re-sort or filter.
 */
const samplesArb = (
  minLength: number,
  maxLength: number,
): fc.Arbitrary<ReadonlyArray<RateSample>> =>
  fc
    .array(
      fc.record({
        // A positive dt between samples; accumulating a prefix-sum of these
        // guarantees strict time monotonicity without reject-filtering.
        dt: fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
        v: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      }),
      { minLength, maxLength },
    )
    .map((records) => {
      let t = 0;
      return records.map(({ dt, v }) => {
        t += dt;
        return { t, v };
      });
    });

// ---------------------------------------------------------------------------
// Property: point count matches 2N for N >= 2; empty for N < 2
// ---------------------------------------------------------------------------

describe("stepPolyline — point count", () => {
  it("produces 2N points for N >= 2 samples", () => {
    fc.assert(
      fc.property(samplesArb(2, 50), (samples) => {
        const points = stepPolyline(samples, 600, 1_000_000, 10, 200);
        expect(points.length).toBe(2 * samples.length);
      }),
    );
  });

  it("returns an empty array for a single sample (no step to draw)", () => {
    const points = stepPolyline([{ t: 500, v: 3 }], 600, 1_000_000, 10, 200);
    expect(points).toEqual([]);
  });

  it("returns an empty array for zero samples", () => {
    const points = stepPolyline([], 600, 1_000_000, 10, 200);
    expect(points).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Property: endpoints anchor to first sample and right edge
// ---------------------------------------------------------------------------

describe("stepPolyline — endpoints", () => {
  it("first point's (x, y) equals timeToX/valueToY of samples[0]", () => {
    fc.assert(
      fc.property(samplesArb(2, 20), (samples) => {
        const width = 800;
        const height = 150;
        const now = samples[samples.length - 1].t + 100;
        const yMax = 50;
        const points = stepPolyline(samples, width, now, yMax, height);
        const first = samples[0];
        expect(points[0].x).toBeCloseTo(timeToX(first.t, width, now), 9);
        expect(points[0].y).toBeCloseTo(valueToY(first.v, height, yMax), 9);
      }),
    );
  });

  it("last point's x equals width and y equals valueToY of samples[N-1]", () => {
    fc.assert(
      fc.property(samplesArb(2, 20), (samples) => {
        const width = 800;
        const height = 150;
        const now = samples[samples.length - 1].t + 100;
        const yMax = 50;
        const points = stepPolyline(samples, width, now, yMax, height);
        const last = samples[samples.length - 1];
        const tail = points[points.length - 1];
        expect(tail.x).toBe(width);
        expect(tail.y).toBeCloseTo(valueToY(last.v, height, yMax), 9);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Property: adjacent points change x OR y, never both (staircase invariant)
// ---------------------------------------------------------------------------

describe("stepPolyline — staircase shape", () => {
  it("between every adjacent pair of points, either x differs or y differs — never both", () => {
    fc.assert(
      fc.property(samplesArb(2, 50), (samples) => {
        const width = 600;
        const height = 200;
        const now = samples[samples.length - 1].t + 100;
        const yMax = 20;
        const points = stepPolyline(samples, width, now, yMax, height);
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const xChanged = prev.x !== curr.x;
          const yChanged = prev.y !== curr.y;
          // The staircase has no diagonals. A segment is either a
          // horizontal hold (x changes, y constant) or a vertical step
          // (y changes, x constant). Equal consecutive samples would
          // produce a zero-length segment; that is acceptable and still
          // satisfies the "never both" invariant.
          expect(xChanged && yChanged).toBe(false);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Example anchors — exact shape verification for a hand-computed case
// ---------------------------------------------------------------------------

describe("stepPolyline — worked examples", () => {
  it("two samples produce moveTo + hold + step + right-edge hold (4 points)", () => {
    // Window = 60_000ms; now = 60_000 → timeToX(t) = 600 * (1 - (60_000 - t)/60_000) = t/100
    // yMax = 10, height = 200 → valueToY(v) = 200 * (1 - v/10) = 200 - 20v
    // samples: [(t=30_000, v=2), (t=45_000, v=5)]
    // Expected:
    //   (300, 160)   moveTo first sample
    //   (450, 160)   hold y0 to x1
    //   (450, 100)   step to y1
    //   (600, 100)   right-edge hold
    const points = stepPolyline(
      [
        { t: 30_000, v: 2 },
        { t: 45_000, v: 5 },
      ],
      600,
      60_000,
      10,
      200,
    );
    expect(points).toEqual([
      { x: 300, y: 160 },
      { x: 450, y: 160 },
      { x: 450, y: 100 },
      { x: 600, y: 100 },
    ]);
  });

  it("three samples produce 6 points with two hold-then-step pairs before the right-edge hold", () => {
    // width=600, now=60_000, yMax=10, height=200, WINDOW_MS=60_000.
    // Picking t values aligned with the window so (60_000 - t)/60_000 is
    // exactly representable in IEEE-754 avoids the comparison needing a
    // tolerance here — the ratios 0/60_000, 30_000/60_000 (0.5), and
    // 45_000/60_000 (0.75) each multiply into integer pixel values.
    // samples: [(15_000, 1), (30_000, 4), (45_000, 2)]
    // x at t: 150 (age 45_000), 300 (age 30_000), 450 (age 15_000).
    // y at v: 180, 120, 160.
    // Expected:
    //   moveTo(150, 180)
    //   lineTo(300, 180)   hold y0 to x1
    //   lineTo(300, 120)   step to y1
    //   lineTo(450, 120)   hold y1 to x2
    //   lineTo(450, 160)   step to y2
    //   lineTo(600, 160)   right-edge hold
    const points = stepPolyline(
      [
        { t: 15_000, v: 1 },
        { t: 30_000, v: 4 },
        { t: 45_000, v: 2 },
      ],
      600,
      60_000,
      10,
      200,
    );
    expect(points).toEqual([
      { x: 150, y: 180 },
      { x: 300, y: 180 },
      { x: 300, y: 120 },
      { x: 450, y: 120 },
      { x: 450, y: 160 },
      { x: 600, y: 160 },
    ]);
  });
});
