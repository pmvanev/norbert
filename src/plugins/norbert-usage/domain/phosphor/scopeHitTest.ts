/**
 * Scope hit-test — pure snap-to-nearest-trace over a projected Frame.
 *
 * Given a pointer position in canvas coordinates and a Frame, return the
 * HoverSelection identifying the nearest trace within HOVER_SNAP_DISTANCE_PX
 * vertically at the pointer's x-time, or `null` when no trace is close enough.
 *
 * Geometry contract (matches the canvas coordinate system used by the scope):
 *   - timeToX(t, width, now) = width * (1 - (now - t) / WINDOW_MS)
 *     (older-left, newer-right; the newest sample sits at x = width)
 *   - valueToY(v, height, yMax) = height * (1 - v / yMax)
 *     (low-value-bottom, high-value-top; canvas origin is top-left)
 *
 * Algorithm:
 *   1. Reject pointers outside [0, width] x [0, height].
 *   2. Convert pointer.x to a cursor-time via the inverse of timeToX.
 *   3. For each trace, find the sample whose time is nearest the cursor-time
 *      (this is the column the pointer is over).
 *   4. Compute the trace's displayY at that sample. An off-canvas sample
 *      (value above yMax, or negative) is visually clipped to the nearest
 *      canvas edge — its effective distance to a pointer inside the canvas
 *      is measured to the clipped edge, so off-scale traces remain hoverable
 *      anywhere at that x-time (a design choice mirroring the scope's visual
 *      clipping behavior).
 *   5. Pick the trace whose vertical distance is minimum; return null if that
 *      distance exceeds HOVER_SNAP_DISTANCE_PX.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`. Inspects only the Frame structure and the
 * HOVER_SNAP_DISTANCE_PX constant.
 */

import { timeToX, valueToY, xToTime } from "./canvasGeometry";
import type { Frame, FrameTrace } from "./scopeProjection";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum pixel distance for snap-to-trace hover. Sourced from the prototype
 * spec (28px ≈ thumb-width on a high-DPI laptop display, comfortable for
 * pointer targeting without feeling sticky).
 */
export const HOVER_SNAP_DISTANCE_PX = 28;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HoverSelection {
  readonly sessionId: string;
  readonly color: string;
  readonly value: number;
  readonly time: number;
  readonly ageMs: number;
  readonly displayX: number;
  readonly displayY: number;
}

// ---------------------------------------------------------------------------
// Hit-test-specific helpers (pure projection math lives in canvasGeometry)
// ---------------------------------------------------------------------------

/**
 * Whether a sample's displayY falls outside the visible canvas (above the
 * top, i.e. displayY < 0, or below the bottom, i.e. displayY > height).
 * Off-canvas samples are visually clipped; the scope still renders them at
 * the edge, so the user can hover anywhere in the canvas at that x-time
 * and expect to select this trace.
 */
const isSampleOffCanvas = (sampleY: number, height: number): boolean =>
  sampleY < 0 || sampleY > height;

/**
 * Effective vertical distance from the pointer to a trace sample's visible
 * rendering. On-canvas samples: absolute y-difference. Off-canvas samples:
 * zero — the trace is clipped to the viewport so the user selecting anywhere
 * at that x-time is still over the trace (off-scale signals remain hoverable,
 * a design choice mirroring the scope's visual clipping behavior — an
 * off-scale trace is rendered pinned to the edge and the user should always
 * be able to investigate it).
 */
const verticalDistanceToTrace = (
  sampleY: number,
  pointerY: number,
  height: number,
): number =>
  isSampleOffCanvas(sampleY, height) ? 0 : Math.abs(sampleY - pointerY);

/** Whether the pointer lies inside the canvas rectangle. */
const isPointerInsideCanvas = (pointer: PointerPosition): boolean =>
  pointer.x >= 0 &&
  pointer.x <= pointer.width &&
  pointer.y >= 0 &&
  pointer.y <= pointer.height;

// ---------------------------------------------------------------------------
// Sample-at-cursor — honest-signal lookup for the trace value at the
// cursor-time. Returns the value of the latest sample whose time is at-or-
// before `cursorTime`, mirroring scopeProjection's `sampleAt` semantics so
// hit-test and trace projection stay consistent (the hover tooltip's
// reported value must equal the value that would be drawn at the pointer's
// x-column). The difference from `sampleAt`: this returns `null` (not 0)
// when the trace is empty, and falls back to the EARLIEST sample when all
// samples sit strictly after the cursor — a hit-test concern that doesn't
// apply to trace drawing.
// ---------------------------------------------------------------------------

/** Value of the latest sample at-or-before `cursorTime`, or `null` when no such sample exists. */
const valueAtCursorTime = (
  trace: FrameTrace,
  cursorTime: number,
): number | null => {
  if (trace.samples.length === 0) return null;
  let latestValue: number | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const sample of trace.samples) {
    if (sample.t <= cursorTime && sample.t >= latestTime) {
      latestTime = sample.t;
      latestValue = sample.v;
    }
  }
  // Fallback: if every sample is strictly after cursorTime, snap to the
  // earliest sample (the pointer is to the left of the first observation).
  if (latestValue === null) {
    let earliest = trace.samples[0];
    for (const sample of trace.samples) {
      if (sample.t < earliest.t) earliest = sample;
    }
    latestValue = earliest.v;
  }
  return latestValue;
};

// ---------------------------------------------------------------------------
// Candidate selection — internal record used during the scan
// ---------------------------------------------------------------------------

interface Candidate {
  readonly trace: FrameTrace;
  readonly cursorTime: number;
  readonly cursorValue: number;
  readonly displayX: number;
  readonly displayY: number;
  readonly verticalDistance: number;
}

/**
 * Build a hit-test candidate for a single trace at the cursor-time, or
 * `null` when the trace has no samples.
 *
 * The reported `cursorValue` is the trace's value at the cursor-time
 * (honest-signal lookup — last sample at-or-before cursorTime); the
 * reported `displayX` is the pointer's x (the sample is "at" the pointer's
 * column, not the sample's own column), because the value lookup behaves
 * like a step function across the cursor's timeline.
 */
const candidateForTrace = (
  trace: FrameTrace,
  pointer: PointerPosition,
  frame: Frame,
  cursorTime: number,
): Candidate | null => {
  const cursorValue = valueAtCursorTime(trace, cursorTime);
  if (cursorValue === null) return null;
  const displayX = timeToX(cursorTime, pointer.width, frame.now);
  const displayY = valueToY(cursorValue, pointer.height, frame.yMax);
  const verticalDistance = verticalDistanceToTrace(
    displayY,
    pointer.y,
    pointer.height,
  );
  return {
    trace,
    cursorTime,
    cursorValue,
    displayX,
    displayY,
    verticalDistance,
  };
};

/** Convert the winning candidate into a HoverSelection. */
const toHoverSelection = (
  candidate: Candidate,
  now: number,
): HoverSelection => ({
  sessionId: candidate.trace.sessionId,
  color: candidate.trace.color,
  value: candidate.cursorValue,
  time: candidate.cursorTime,
  ageMs: Math.max(0, now - candidate.cursorTime),
  displayX: candidate.displayX,
  displayY: candidate.displayY,
});

// ---------------------------------------------------------------------------
// scopeHitTest — the driving port
// ---------------------------------------------------------------------------

/**
 * Pure hit-test. Deterministic in (pointer, frame).
 *
 * Returns the HoverSelection for the trace whose sample nearest the pointer's
 * cursor-time has the minimum vertical distance to the pointer, provided
 * that distance is ≤ HOVER_SNAP_DISTANCE_PX. Off-canvas samples (values
 * above yMax or negative) are considered clipped to the canvas edge — a
 * pointer inside the canvas at that x-time is effectively on the clipped
 * trace, so off-scale signals remain hoverable.
 *
 * Returns `null` when:
 *   - the pointer is outside `[0, width] x [0, height]`
 *   - the frame has no traces
 *   - no trace has any samples
 *   - the nearest on-canvas trace is beyond the snap radius
 */
export const scopeHitTest = (
  pointer: PointerPosition,
  frame: Frame,
): HoverSelection | null => {
  if (!isPointerInsideCanvas(pointer)) return null;
  const cursorTime = xToTime(pointer.x, pointer.width, frame.now);
  let winner: Candidate | null = null;
  for (const trace of frame.traces) {
    const candidate = candidateForTrace(trace, pointer, frame, cursorTime);
    if (candidate === null) continue;
    if (winner === null || candidate.verticalDistance < winner.verticalDistance) {
      winner = candidate;
    }
  }
  if (winner === null) return null;
  if (winner.verticalDistance > HOVER_SNAP_DISTANCE_PX) return null;
  return toHoverSelection(winner, frame.now);
};
