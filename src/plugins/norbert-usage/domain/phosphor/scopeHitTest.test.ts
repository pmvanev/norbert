/**
 * Unit tests: scopeHitTest — pure hit-test over a projected Frame.
 *
 * Behaviors (drives later M4-S2/4/5/6):
 *   1. within-snap:   pointer within HOVER_SNAP_DISTANCE_PX vertical of the
 *                     trace sample at the cursor-time returns a HoverSelection
 *                     identifying that trace.
 *   2. beyond-snap:   pointer outside HOVER_SNAP_DISTANCE_PX vertically
 *                     from every on-canvas trace sample returns null.
 *   3. outside-bounds: pointer x/y outside [0,width]/[0,height] returns null.
 *   4. empty-frame:   frame with no traces returns null regardless of pointer.
 *   5. nearest-of-two: when two traces' samples are within snap, selection
 *                      picks the vertically-closer one.
 *
 * Geometry contract (match the canvas coordinate system used by the scope):
 *   - timeToX(t, width, now) = width * (1 - (now - t) / WINDOW_MS)
 *     (older-left, newer-right; the newest sample sits at x = width)
 *   - valueToY(v, height, yMax) = height * (1 - v / yMax)
 *     (low-value-bottom, high-value-top; canvas origin is top-left)
 *
 * Snap semantics: vertical distance only. The cursor-time is derived from
 * pointer.x and each trace's sample-at-cursor-time determines the trace's
 * y at the pointer's column. Off-canvas sample y positions clip to the
 * nearest canvas edge for distance measurement (off-scale signals remain
 * hoverable — a design choice mirroring the scope's visual clipping).
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`. The function only inspects the Frame structure.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { HOVER_SNAP_DISTANCE_PX, scopeHitTest } from "./scopeHitTest";
import type { Frame } from "./scopeProjection";
import { timeToX, valueToY } from "./canvasGeometry";
import {
  METRICS,
  SESSION_COLORS,
  type RateSample,
} from "./phosphorMetricConfig";

const NOW = 1_000_000_000;

// ---------------------------------------------------------------------------
// Frame construction helpers — avoid depending on buildFrame so hit-test
// unit tests remain narrow and decoupled from projection behavior.
// Projection math imported from `canvasGeometry` so test expectations
// match production exactly.
// ---------------------------------------------------------------------------

const buildTestFrame = (
  traceSpecs: ReadonlyArray<{
    readonly sessionId: string;
    readonly color: string;
    readonly samples: ReadonlyArray<RateSample>;
    readonly displayLabel?: string;
  }>,
): Frame => {
  const traces = traceSpecs.map((spec) => ({
    sessionId: spec.sessionId,
    color: spec.color,
    displayLabel: spec.displayLabel ?? spec.sessionId,
    samples: spec.samples,
    latestValue:
      spec.samples.length === 0 ? null : spec.samples[spec.samples.length - 1].v,
  }));
  return {
    now: NOW,
    metric: "events",
    yMax: METRICS.events.yMax,
    unit: METRICS.events.unit,
    traces,
    pulses: [],
    legend: traces.map((t) => ({
      sessionId: t.sessionId,
      color: t.color,
      displayLabel: t.displayLabel,
      latestValue: t.latestValue,
    })),
  };
};

// ---------------------------------------------------------------------------
// Case 1: within-snap — pointer near a trace sample returns a HoverSelection
// ---------------------------------------------------------------------------

describe("scopeHitTest — within snap distance", () => {
  it("returns a HoverSelection when pointer is exactly on the sample", () => {
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 1500; // 1.5 seconds ago
    const sampleValue = 10;
    const frame = buildTestFrame([
      {
        sessionId: "session-1",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: sampleValue }],
      },
    ]);

    const x = timeToX(sampleTime, width, NOW);
    const y = valueToY(sampleValue, height, METRICS.events.yMax);

    const selection = scopeHitTest({ x, y, width, height }, frame);

    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("session-1");
    expect(selection?.color).toBe(SESSION_COLORS[0]);
    expect(selection?.value).toBe(sampleValue);
    expect(selection?.time).toBe(sampleTime);
    expect(selection?.ageMs).toBeCloseTo(1500, 3);
    expect(selection?.displayX).toBeCloseTo(x, 3);
    expect(selection?.displayY).toBeCloseTo(y, 3);
  });

  it("copies displayLabel from the matched trace into the HoverSelection", () => {
    // HoverSelection surfaces the same visible identifier the legend uses,
    // so the tooltip never shows a raw UUID when a session label is known.
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 1500;
    const sampleValue = 10;
    const frame = buildTestFrame([
      {
        sessionId: "9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
        displayLabel: "norbert",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: sampleValue }],
      },
    ]);

    const x = timeToX(sampleTime, width, NOW);
    const y = valueToY(sampleValue, height, METRICS.events.yMax);
    const selection = scopeHitTest({ x, y, width, height }, frame);

    expect(selection).not.toBeNull();
    expect(selection?.displayLabel).toBe("norbert");
  });

  it("returns a HoverSelection when pointer is vertically within HOVER_SNAP_DISTANCE_PX", () => {
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 2000;
    const sampleValue = 8;
    const frame = buildTestFrame([
      {
        sessionId: "session-a",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: sampleValue }],
      },
    ]);

    const sampleX = timeToX(sampleTime, width, NOW);
    const sampleY = valueToY(sampleValue, height, METRICS.events.yMax);
    // Pointer vertically 12px below the sample — within the 18px snap radius.
    const selection = scopeHitTest(
      { x: sampleX, y: sampleY + 12, width, height },
      frame,
    );

    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("session-a");
    expect(selection?.value).toBe(sampleValue);
  });

  it("includes off-canvas (above yMax) traces — they clip to the top edge and remain hoverable", () => {
    // WS-4 shape: value > yMax → displayY < 0. The trace clips to the top
    // edge (y=0) and a pointer inside the canvas at that x-time is within
    // snap vertically only if it is within HOVER_SNAP_DISTANCE_PX of y=0.
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 1500;
    const offScaleValue = 47; // > events yMax of 15
    const frame = buildTestFrame([
      {
        sessionId: "focused",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: offScaleValue }],
      },
    ]);

    // Pointer near the top edge — clipped trace is at y=0, snap holds.
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: 10, width, height }, frame);

    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("focused");
    expect(selection?.value).toBe(offScaleValue);
  });
});

// ---------------------------------------------------------------------------
// Case 2: beyond-snap — pointer too far from every trace returns null
// ---------------------------------------------------------------------------

describe("scopeHitTest — beyond snap distance", () => {
  it("returns null when the pointer is vertically farther than HOVER_SNAP_DISTANCE_PX from the trace", () => {
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 1000;
    const sampleValue = 2;
    const frame = buildTestFrame([
      {
        sessionId: "session-1",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: sampleValue }],
      },
    ]);

    const sampleY = valueToY(sampleValue, height, METRICS.events.yMax);
    const sampleX = timeToX(sampleTime, width, NOW);
    // 100px vertical offset — well outside the 18px snap radius.
    const selection = scopeHitTest(
      { x: sampleX, y: sampleY - 100, width, height },
      frame,
    );

    expect(selection).toBeNull();
  });

  it("property: pointer vertically farther than HOVER_SNAP_DISTANCE_PX from an on-scale trace returns null", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 2000 }), // width
        fc.integer({ min: 200, max: 800 }), // height
        fc.integer({ min: 40, max: 500 }), // vertical offset beyond snap
        (width, height, offsetPx) => {
          // On-scale sample: value well within [0, yMax].
          const yMax = METRICS.events.yMax;
          const midValue = yMax / 2;
          const frame = buildTestFrame([
            {
              sessionId: "s1",
              color: SESSION_COLORS[0],
              samples: [{ t: NOW - 5000, v: midValue }],
            },
          ]);
          const sampleX = timeToX(NOW - 5000, width, NOW);
          const sampleY = valueToY(midValue, height, yMax);
          // Place pointer vertically offset — choose direction that keeps it
          // inside the canvas.
          const directions = [sampleY - offsetPx, sampleY + offsetPx].filter(
            (py) => py >= 0 && py <= height,
          );
          for (const py of directions) {
            const selection = scopeHitTest(
              { x: sampleX, y: py, width, height },
              frame,
            );
            expect(selection).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Case 3: outside-bounds — pointer outside the canvas returns null
// ---------------------------------------------------------------------------

describe("scopeHitTest — pointer outside canvas bounds", () => {
  // Fixture-helper: construct a frame whose sample would produce a valid
  // selection if the pointer were inside the canvas. This makes the
  // "returns null" assertion contingent specifically on the out-of-bounds
  // guard, so mutating any of the four conjuncts in isPointerInsideCanvas
  // yields a detectable difference (null vs. valid selection).
  const width = 1000;
  const height = 400;
  const yMax = METRICS.events.yMax;
  const sampleTime = NOW - 10_000;
  // Pick a sample value so that the trace's displayY lies near the pointer's
  // y when the pointer is clamped into the canvas — this guarantees the
  // "inside" case would return a selection, not null.
  const sampleValue = yMax / 2;
  const frameWithSelectableTrace = buildTestFrame([
    {
      sessionId: "selectable",
      color: SESSION_COLORS[0],
      samples: [{ t: sampleTime, v: sampleValue }],
    },
  ]);
  const sampleX = timeToX(sampleTime, width, NOW);
  const sampleY = valueToY(sampleValue, height, yMax);

  it("returns null when pointer x is negative (and the inside-case would select)", () => {
    const selection = scopeHitTest(
      { x: -5, y: sampleY, width, height },
      frameWithSelectableTrace,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer x exceeds width (and the inside-case would select)", () => {
    const selection = scopeHitTest(
      { x: width + 1, y: sampleY, width, height },
      frameWithSelectableTrace,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer y is negative (and the inside-case would select)", () => {
    const selection = scopeHitTest(
      { x: sampleX, y: -1, width, height },
      frameWithSelectableTrace,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer y exceeds height (and the inside-case would select)", () => {
    const selection = scopeHitTest(
      { x: sampleX, y: height + 1, width, height },
      frameWithSelectableTrace,
    );
    expect(selection).toBeNull();
  });

  it("control: pointer at (sampleX, sampleY) inside canvas returns the selectable trace", () => {
    // Sanity check that the above fixture really would select when inside —
    // this is the symmetric counterexample that converts the isPointerInsideCanvas
    // conjunct mutants from "survive" to "kill" by disagreeing with the
    // out-of-bounds null-return on the same fixture.
    const selection = scopeHitTest(
      { x: sampleX, y: sampleY, width, height },
      frameWithSelectableTrace,
    );
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("selectable");
  });
});

// ---------------------------------------------------------------------------
// Case 4: empty-frame — no traces means no hover selection ever
// ---------------------------------------------------------------------------

describe("scopeHitTest — empty frame", () => {
  it("returns null when frame has zero traces", () => {
    const frame = buildTestFrame([]);
    const selection = scopeHitTest(
      { x: 500, y: 200, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
  });

  it("returns null when all traces have zero samples", () => {
    const frame = buildTestFrame([
      { sessionId: "s1", color: SESSION_COLORS[0], samples: [] },
      { sessionId: "s2", color: SESSION_COLORS[1], samples: [] },
    ]);
    const selection = scopeHitTest(
      { x: 500, y: 200, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 5: nearest-of-two — when multiple traces are within snap, pick nearest
// ---------------------------------------------------------------------------

describe("scopeHitTest — nearest of two candidates", () => {
  it("selects the trace whose sample is vertically closer to the pointer", () => {
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    const sampleTime = NOW - 10000;

    // Two on-scale traces at the same x but different values.
    const valueA = 2;
    const valueB = 10;
    const frame = buildTestFrame([
      {
        sessionId: "session-A",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: valueA }],
      },
      {
        sessionId: "session-B",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: valueB }],
      },
    ]);

    const x = timeToX(sampleTime, width, NOW);
    const yB = valueToY(valueB, height, yMax);
    // Pointer very close to trace-B's sample — should select session-B.
    const selection = scopeHitTest({ x, y: yB + 3, width, height }, frame);

    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("session-B");
    expect(selection?.value).toBe(valueB);
  });

  it("does not select a trace whose sample is beyond snap when a closer trace is within snap", () => {
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    const sampleTime = NOW - 10000;

    // Trace A sits at pointer y; trace B sits 200px below — beyond snap.
    const pointerY = valueToY(5, height, yMax);
    const frame = buildTestFrame([
      {
        sessionId: "close",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: 5 }],
      },
      {
        sessionId: "far",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: 5 - (200 * yMax) / height }],
      },
    ]);

    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: pointerY, width, height }, frame);

    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("close");
  });
});

// ---------------------------------------------------------------------------
// Case 6: canvas-edge boundary — pointer exactly at (0,y), (width,y),
// (x,0), (x,height) is INSIDE the canvas per the inclusive-edge contract.
// This exercises the four `>=` / `<=` conjuncts in isPointerInsideCanvas.
// ---------------------------------------------------------------------------

describe("scopeHitTest — pointer exactly on canvas edges (inclusive)", () => {
  const width = 1000;
  const height = 400;
  const yMax = METRICS.events.yMax;
  // Centered sample so any edge-pointer we place is close enough vertically.
  const sampleValue = yMax / 2;
  const sampleTime = NOW - 30_000; // middle of the window
  const frame = buildTestFrame([
    {
      sessionId: "edge-session",
      color: SESSION_COLORS[0],
      samples: [{ t: sampleTime, v: sampleValue }],
    },
  ]);
  const sampleY = valueToY(sampleValue, height, yMax);

  it("returns a selection when pointer.x === 0 (left edge inclusive)", () => {
    const selection = scopeHitTest({ x: 0, y: sampleY, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("edge-session");
  });

  it("returns a selection when pointer.x === width (right edge inclusive)", () => {
    const selection = scopeHitTest({ x: width, y: sampleY, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("edge-session");
  });

  it("returns a selection when pointer.y === 0 (top edge inclusive) and a trace is near top", () => {
    // Place the sample near the top so y=0 is within snap distance vertically.
    const topSampleValue = yMax - 0.1; // nearly at top
    const topFrame = buildTestFrame([
      {
        sessionId: "top-session",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: topSampleValue }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: 0, width, height }, topFrame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("top-session");
  });

  it("returns a selection when pointer.y === height (bottom edge inclusive) and a trace is near bottom", () => {
    // Place the sample near the bottom so y=height is within snap distance.
    const bottomSampleValue = 0.1; // nearly at bottom
    const bottomFrame = buildTestFrame([
      {
        sessionId: "bottom-session",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: bottomSampleValue }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: height, width, height }, bottomFrame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("bottom-session");
  });
});

// ---------------------------------------------------------------------------
// Case 7: sample-on-edge — sample at y=0 (top) or y=height (bottom) is
// considered ON the canvas per the STRICT `< 0` / `> height` off-canvas
// test. A pointer somewhere else at that x must compute vertical distance
// from the sample position (not treat the sample as clipped).
// ---------------------------------------------------------------------------

describe("scopeHitTest — sample exactly on canvas edge is not off-canvas", () => {
  const width = 1000;
  const height = 400;
  const yMax = METRICS.events.yMax;

  it("sample at v=yMax (displayY === 0) is on-canvas: pointer at y=200 is beyond snap", () => {
    // displayY for v=yMax is exactly 0 (top edge). The off-canvas test is
    // STRICT (`sampleY < 0`), so the sample is on-canvas and vertical
    // distance is |0 - 200| = 200 — far beyond the 18px snap radius.
    const sampleTime = NOW - 5000;
    const frame = buildTestFrame([
      {
        sessionId: "on-top-edge",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: yMax }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: 200, width, height }, frame);
    expect(selection).toBeNull();
  });

  it("sample at v=0 (displayY === height) is on-canvas: pointer at y=0 is beyond snap", () => {
    // displayY for v=0 is exactly `height` (bottom edge). The off-canvas
    // test is STRICT (`sampleY > height`), so the sample is on-canvas and
    // vertical distance is `height` — far beyond the 18px snap radius.
    const sampleTime = NOW - 5000;
    const frame = buildTestFrame([
      {
        sessionId: "on-bottom-edge",
        color: SESSION_COLORS[0],
        samples: [{ t: sampleTime, v: 0 }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: 0, width, height }, frame);
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 8: sample-at-exact-cursor-time — valueAtCursorTime uses the
// inclusive `sample.t <= cursorTime` predicate. A sample whose time is
// exactly equal to the cursor time must be selected (not skipped).
// ---------------------------------------------------------------------------

describe("scopeHitTest — sample time equals cursor time", () => {
  it("selects the sample whose time exactly equals the cursor time (inclusive <=)", () => {
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    // Pick a sample time, put the pointer at exactly the same x-column so
    // the derived cursor time equals the sample's time.
    const exactTime = NOW - 15_000;
    const sampleValue = yMax / 3;
    const frame = buildTestFrame([
      {
        sessionId: "exact",
        color: SESSION_COLORS[0],
        samples: [{ t: exactTime, v: sampleValue }],
      },
    ]);
    const x = timeToX(exactTime, width, NOW);
    const y = valueToY(sampleValue, height, yMax);

    const selection = scopeHitTest({ x, y, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.value).toBe(sampleValue);
    expect(selection?.time).toBe(exactTime);
  });

  it("selects the earliest sample when cursor time is strictly before every sample", () => {
    // Fallback path: every sample.t > cursorTime. valueAtCursorTime returns
    // the earliest sample's value. The resulting selection is on-canvas and
    // should be reported.
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    const earliestTime = NOW - 10_000;
    const earliestValue = yMax / 4;
    const frame = buildTestFrame([
      {
        sessionId: "falling-back",
        color: SESSION_COLORS[0],
        samples: [
          { t: earliestTime, v: earliestValue },
          { t: NOW - 5000, v: yMax / 2 },
        ],
      },
    ]);
    // Pointer at the left edge — cursorTime corresponds to NOW - WINDOW_MS,
    // which is strictly before earliestTime (earliestTime = NOW - 10_000,
    // cursorTime = NOW - 60_000). The selection.time is the cursor time
    // (step-function semantics), but the reported value is the earliest
    // sample's value — that's the fallback-earliest contract under test.
    const yOfEarliest = valueToY(earliestValue, height, yMax);
    const selection = scopeHitTest({ x: 0, y: yOfEarliest, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.value).toBe(earliestValue);
    expect(selection?.sessionId).toBe("falling-back");
  });
});

// ---------------------------------------------------------------------------
// Case 9: snap-distance boundary — `verticalDistance > HOVER_SNAP_DISTANCE_PX`
// returns null; `verticalDistance === HOVER_SNAP_DISTANCE_PX` returns a
// selection (boundary is inclusive of the snap radius).
// ---------------------------------------------------------------------------

describe("scopeHitTest — snap distance boundary", () => {
  const width = 1000;
  const height = 400;
  const yMax = METRICS.events.yMax;
  const sampleTime = NOW - 10_000;
  const sampleValue = yMax / 2;
  const frame = buildTestFrame([
    {
      sessionId: "snap-boundary",
      color: SESSION_COLORS[0],
      samples: [{ t: sampleTime, v: sampleValue }],
    },
  ]);
  const x = timeToX(sampleTime, width, NOW);
  const sampleY = valueToY(sampleValue, height, yMax);

  it("returns a selection when vertical distance equals HOVER_SNAP_DISTANCE_PX (inclusive boundary)", () => {
    const selection = scopeHitTest(
      { x, y: sampleY + HOVER_SNAP_DISTANCE_PX, width, height },
      frame,
    );
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("snap-boundary");
  });

  it("returns null when vertical distance is just beyond HOVER_SNAP_DISTANCE_PX", () => {
    const selection = scopeHitTest(
      { x, y: sampleY + HOVER_SNAP_DISTANCE_PX + 1, width, height },
      frame,
    );
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 9b: sample-time strictly greater than cursor — a sample whose time
// is AFTER the cursor must be ignored in the main loop (it's looking for
// sample.t <= cursorTime). The fallback then chooses the earliest. This
// kills the `sample.t < cursorTime` / `sample.t <= cursorTime` equality
// flip on line 133.
// ---------------------------------------------------------------------------

describe("scopeHitTest — sample time strictly after cursor vs. equal-to cursor", () => {
  it("returns value of earliest sample when ALL samples are strictly after cursor time", () => {
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    // Two samples, both AFTER cursor (pointer at x=0 → cursorTime = NOW-60_000).
    const valueA = yMax / 5;
    const valueB = yMax / 2;
    const frame = buildTestFrame([
      {
        sessionId: "after-only",
        color: SESSION_COLORS[0],
        samples: [
          { t: NOW - 1000, v: valueA },
          { t: NOW - 500, v: valueB }, // strictly later than earliest
        ],
      },
    ]);
    // Fallback-earliest: sample.t < earliest.t chooses valueA (t=NOW-1000).
    // If the mutator flips to `<=`, the iteration order still yields valueA
    // first (NOW-1000) and then valueB (NOW-500 is not <= NOW-1000), so
    // earliest stays valueA. We need a scenario where `<` vs. `<=` matters.
    // Place pointer at the earliest sample's y so we can confirm value.
    const yOfValueA = valueToY(valueA, height, yMax);
    const selection = scopeHitTest({ x: 0, y: yOfValueA, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.value).toBe(valueA);
    expect(selection?.sessionId).toBe("after-only");
  });

  it("fallback-earliest chooses the FIRST sample encountered at the minimum timestamp (strict < semantics)", () => {
    // To exercise `sample.t < earliest.t` vs. `<=`: construct two samples
    // sharing the minimum timestamp but with DIFFERENT values. Under the
    // correct strict `<`, the first-seen sample is kept (a later equal-time
    // sample does NOT satisfy `sample.t < earliest.t`). Under a mutant `<=`,
    // the second sample WOULD satisfy the condition and overwrite the first,
    // flipping the returned value.
    //
    // Both samples' y-positions are placed within HOVER_SNAP_DISTANCE_PX of
    // the pointer so hit-test returns a non-null selection under BOTH the
    // production and mutant variants. The distinction is observable purely
    // via `selection.value`: production returns the FIRST sample's value,
    // mutant returns the SECOND.
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax; // 15
    const sharedTime = NOW - 1000;
    // Place the two values close enough that their projected y-positions
    // are ~10 px apart — well inside HOVER_SNAP_DISTANCE_PX (28).
    //   yOfFirst  = height * (1 - firstValue/yMax)
    //   yOfSecond = height * (1 - secondValue/yMax)
    //   dy        = height * (secondValue - firstValue) / yMax
    // With height=400, yMax=15, Δv=yMax/40=0.375, dy ≈ 10 px.
    const firstValue = yMax / 4; // 3.75  -> y ≈ 300
    const secondValue = firstValue + yMax / 40; // 4.125 -> y ≈ 290 (10 px above)
    const frame = buildTestFrame([
      {
        sessionId: "duplicate-time",
        color: SESSION_COLORS[0],
        samples: [
          { t: sharedTime, v: firstValue },
          { t: sharedTime, v: secondValue },
        ],
      },
    ]);
    // Pointer x=0 → cursorTime = NOW - WINDOW_MS, which is strictly before
    // sharedTime, forcing the fallback-earliest branch. Pointer y is set
    // exactly at yOfFirst so:
    //   - Under `<` (production): earliest.v stays `firstValue`,
    //     displayY = yOfFirst, distance = 0 → selection.value === firstValue.
    //   - Under `<=` (mutant): earliest.v becomes `secondValue`,
    //     displayY = yOfSecond, distance ≈ 10 px (still < 18 snap) →
    //     selection.value === secondValue (FAILS the assertion below).
    const yOfFirst = valueToY(firstValue, height, yMax);
    const selection = scopeHitTest({ x: 0, y: yOfFirst, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.value).toBe(firstValue);
    // Explicit mutant-guard: the SECOND sample's value must NOT win under
    // strict `<`. This assertion makes the `< → <=` distinction loud.
    expect(selection?.value).not.toBe(secondValue);
  });
});

// ---------------------------------------------------------------------------
// Case 9c: mixed traces (empty + populated) — the empty trace must be
// skipped (candidateForTrace returns null → outer loop continues). Kills
// the line-180 `if (cursorValue === null) return null;` guard and the
// line-241 `if (candidate === null) continue;` guard by exposing the
// populated trace's selection as the winner.
// ---------------------------------------------------------------------------

describe("scopeHitTest — mixed empty and populated traces", () => {
  it("skips the empty trace and selects the populated one", () => {
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    const sampleTime = NOW - 10_000;
    const sampleValue = yMax / 2;
    const frame = buildTestFrame([
      // First trace is empty — candidateForTrace should return null and
      // the outer loop should `continue` past it.
      { sessionId: "empty", color: SESSION_COLORS[0], samples: [] },
      // Second trace has a sample — should be selected.
      {
        sessionId: "populated",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: sampleValue }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const y = valueToY(sampleValue, height, yMax);
    const selection = scopeHitTest({ x, y, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("populated");
  });

  it("returns null when the only populated trace is beyond snap distance", () => {
    // Negative control: empty + populated-but-far trace. The empty trace
    // must still be skipped (not crash), and the far trace must produce
    // null because of snap, not because of the empty-guard.
    const width = 1000;
    const height = 400;
    const yMax = METRICS.events.yMax;
    const sampleTime = NOW - 10_000;
    const farSampleValue = yMax / 2;
    const frame = buildTestFrame([
      { sessionId: "empty", color: SESSION_COLORS[0], samples: [] },
      {
        sessionId: "far",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: farSampleValue }],
      },
    ]);
    const x = timeToX(sampleTime, width, NOW);
    const y = valueToY(farSampleValue, height, yMax);
    // Pointer 200px above the far sample — well beyond snap.
    const selection = scopeHitTest({ x, y: y - 200, width, height }, frame);
    expect(selection).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 10: off-canvas sample below baseline — `sampleY > height`. Mirrors
// the existing "above top" case and exercises the second disjunct of
// isSampleOffCanvas.
// ---------------------------------------------------------------------------

describe("scopeHitTest — off-canvas samples below baseline", () => {
  it("selects a trace whose sample is below baseline (clipped to bottom edge)", () => {
    const width = 1000;
    const height = 400;
    const sampleTime = NOW - 1500;
    const negativeValue = -3; // < 0 → displayY > height → off-canvas
    const frame = buildTestFrame([
      {
        sessionId: "below-baseline",
        color: SESSION_COLORS[1],
        samples: [{ t: sampleTime, v: negativeValue }],
      },
    ]);
    // Pointer anywhere inside the canvas at the sample's x-time should
    // select this trace: off-canvas samples clip to the edge and verticalDistance = 0.
    const x = timeToX(sampleTime, width, NOW);
    const selection = scopeHitTest({ x, y: height - 10, width, height }, frame);
    expect(selection).not.toBeNull();
    expect(selection?.sessionId).toBe("below-baseline");
    expect(selection?.value).toBe(negativeValue);
  });
});

// ---------------------------------------------------------------------------
// HOVER_SNAP_DISTANCE_PX export — constant exposed for downstream config
// ---------------------------------------------------------------------------

describe("scopeHitTest — exported constants", () => {
  it("exports HOVER_SNAP_DISTANCE_PX = 18", () => {
    expect(HOVER_SNAP_DISTANCE_PX).toBe(18);
  });
});
