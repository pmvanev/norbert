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
import {
  METRICS,
  SESSION_COLORS,
  WINDOW_MS,
  type RateSample,
} from "./phosphorMetricConfig";

const NOW = 1_000_000_000;

// ---------------------------------------------------------------------------
// Frame construction helpers — avoid depending on buildFrame so hit-test
// unit tests remain narrow and decoupled from projection behavior.
// ---------------------------------------------------------------------------

const timeToX = (t: number, width: number, now: number): number =>
  width * (1 - (now - t) / WINDOW_MS);

const valueToY = (v: number, height: number, yMax: number): number =>
  height * (1 - v / yMax);

const buildTestFrame = (
  traceSpecs: ReadonlyArray<{
    readonly sessionId: string;
    readonly color: string;
    readonly samples: ReadonlyArray<RateSample>;
  }>,
): Frame => {
  const traces = traceSpecs.map((spec) => ({
    sessionId: spec.sessionId,
    color: spec.color,
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
    // Pointer vertically 20px below the sample — within the 28px snap radius.
    const selection = scopeHitTest(
      { x: sampleX, y: sampleY + 20, width, height },
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
    // 100px vertical offset — well outside the 28px snap radius.
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
  it("returns null when pointer x is negative", () => {
    const frame = buildTestFrame([
      {
        sessionId: "s1",
        color: SESSION_COLORS[0],
        samples: [{ t: NOW - 1000, v: 5 }],
      },
    ]);
    const selection = scopeHitTest(
      { x: -5, y: 100, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer x exceeds width", () => {
    const frame = buildTestFrame([
      {
        sessionId: "s1",
        color: SESSION_COLORS[0],
        samples: [{ t: NOW - 1000, v: 5 }],
      },
    ]);
    const selection = scopeHitTest(
      { x: 1001, y: 100, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer y is negative", () => {
    const frame = buildTestFrame([
      {
        sessionId: "s1",
        color: SESSION_COLORS[0],
        samples: [{ t: NOW - 1000, v: 5 }],
      },
    ]);
    const selection = scopeHitTest(
      { x: 500, y: -1, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
  });

  it("returns null when pointer y exceeds height", () => {
    const frame = buildTestFrame([
      {
        sessionId: "s1",
        color: SESSION_COLORS[0],
        samples: [{ t: NOW - 1000, v: 5 }],
      },
    ]);
    const selection = scopeHitTest(
      { x: 500, y: 401, width: 1000, height: 400 },
      frame,
    );
    expect(selection).toBeNull();
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
// HOVER_SNAP_DISTANCE_PX export — constant exposed for downstream config
// ---------------------------------------------------------------------------

describe("scopeHitTest — exported constants", () => {
  it("exports HOVER_SNAP_DISTANCE_PX = 28", () => {
    expect(HOVER_SNAP_DISTANCE_PX).toBe(28);
  });
});
