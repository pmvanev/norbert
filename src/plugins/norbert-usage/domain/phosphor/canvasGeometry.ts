/**
 * Canvas geometry — pure projection math shared by scope hit-test and
 * canvas rendering.
 *
 * The phosphor scope maps a sample's `(t, v)` pair into canvas pixels via
 * a linear projection. Two consumers need the SAME projection:
 *
 *   - `scopeHitTest.ts` (pure domain): inverts x to cursor-time and
 *     forward-maps sample `(t, v)` to pixels for distance comparison.
 *   - `views/phosphor/PhosphorCanvasHost.tsx` (view effect): draws
 *     trace polylines and pulse flares at the same pixel coordinates.
 *
 * Extracting these helpers eliminates the duplicate-code drift risk: hover
 * and render MUST agree on geometry or the tooltip will point at the wrong
 * location. A shared module makes that invariant structural.
 *
 * Geometry contract (matches the canvas coordinate system used by the scope):
 *   timeToX(t, width, now) = width * (1 - (now - t) / WINDOW_MS)
 *     older-left, newer-right; the newest sample sits at x = width.
 *   valueToY(v, height, yMax) = height * (1 - v / yMax)
 *     low-value-bottom, high-value-top; canvas origin is top-left.
 *   xToTime(x, width, now) is the inverse of timeToX.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`. Depends only on the seam constants in
 * `phosphorMetricConfig`.
 */

import { WINDOW_MS } from "./phosphorMetricConfig";

/** Map a sample time `t` to x pixels within `[0, width]` given `now`. */
export const timeToX = (t: number, width: number, now: number): number =>
  width * (1 - (now - t) / WINDOW_MS);

/** Inverse of timeToX: map a pointer x to a cursor-time given `now`. */
export const xToTime = (x: number, width: number, now: number): number =>
  now - (1 - x / width) * WINDOW_MS;

/** Map a sample value `v` to y pixels within `[0, height]` given `yMax`. */
export const valueToY = (v: number, height: number, yMax: number): number =>
  height * (1 - v / yMax);
