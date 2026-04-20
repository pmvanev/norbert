/**
 * Step-function polyline generator — pure producer of the ordered point
 * sequence a canvas walks to render a sample-and-hold (staircase) trace.
 *
 * The phosphor scope renders traces as square waves rather than connecting
 * consecutive samples with diagonal lines. Each sample holds its value from
 * its own timestamp until the next sample's timestamp, then the trace steps
 * vertically to the new value. After the last sample, the trace holds its
 * last value out to the right edge (x = width) so the current value is
 * visible at the scope's leading edge — matching conventional oscilloscope
 * rendering and `scopeHitTest`'s at-or-before sample-lookup semantics.
 *
 * Output shape for N >= 2 samples:
 *
 *   (x0, y0)                      ← first sample (caller treats as moveTo)
 *   (x1, y0) (x1, y1)             ← hold y0 to x1, step to y1
 *   (x2, y1) (x2, y2)             ← hold y1 to x2, step to y2
 *   ...
 *   (xN-1, yN-2) (xN-1, yN-1)     ← hold to last sample, step to its value
 *   (width, yN-1)                 ← hold last value out to right edge
 *
 * Total point count: 1 + 2*(N-1) + 1 = 2N.
 *
 * For N < 2 the helper returns an empty array — a single sample has no step
 * to draw, matching the `samples.length < 2` early return in the renderer.
 *
 * Extracting this as a pure helper keeps `drawTrace` (an effect over
 * `CanvasRenderingContext2D`) trivial: iterate the points with `moveTo` for
 * the first and `lineTo` for the rest. Geometry stays unit-testable.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`.
 */

import { timeToX, valueToY } from "./canvasGeometry";
import type { RateSample } from "./phosphorMetricConfig";

/** A point on the canvas in CSS pixels. */
export interface PolylinePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Produce the step-function polyline for a trace. See module docstring for
 * the output shape and invariants.
 *
 * @param samples    trace samples in time-ascending order
 * @param width      canvas width in CSS pixels
 * @param now        frame's right-edge time (ms since epoch)
 * @param yMax       value mapping to y = 0 (top of canvas)
 * @param height     canvas height in CSS pixels
 */
export const stepPolyline = (
  samples: ReadonlyArray<RateSample>,
  width: number,
  now: number,
  yMax: number,
  height: number,
): ReadonlyArray<PolylinePoint> => {
  if (samples.length < 2) return [];

  const points: PolylinePoint[] = [];

  // First point: the initial sample. The caller treats this as moveTo.
  const first = samples[0];
  let prevY = valueToY(first.v, height, yMax);
  points.push({ x: timeToX(first.t, width, now), y: prevY });

  // For each subsequent sample, emit TWO points:
  //   - (xi, prevY) holds the previous value horizontally up to the new x
  //   - (xi, newY)  steps vertically to the new value
  for (let i = 1; i < samples.length; i++) {
    const sample = samples[i];
    const x = timeToX(sample.t, width, now);
    const y = valueToY(sample.v, height, yMax);
    points.push({ x, y: prevY });
    points.push({ x, y });
    prevY = y;
  }

  // Finally, hold the last value out to the right edge so the current value
  // is visible at the scope's leading edge rather than truncating at the
  // last sample's x.
  points.push({ x: width, y: prevY });

  return points;
};
