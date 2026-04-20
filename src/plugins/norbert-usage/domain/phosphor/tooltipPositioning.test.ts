/**
 * Unit tests: normalizeClientPointer — CSS-zoom compensation for viewport
 * pointer coordinates.
 *
 * Motivation:
 *   `document.documentElement.style.zoom` (set by Ctrl-+/- in main.tsx)
 *   inflates `getBoundingClientRect()` dimensions relative to the unzoomed
 *   logical canvas size. `event.clientX/Y` arrive in the zoomed coordinate
 *   space, but `position: fixed` expects unzoomed CSS layout pixels. The
 *   ratio of zoomed rect dimensions to unzoomed logical dimensions IS the
 *   CSS zoom factor; dividing client coords by that ratio normalizes them.
 *
 * Properties under test:
 *   1. Identity when zoom factor is 1 (rect === logical dims).
 *   2. Linear inverse: zoom=k halves coords at k=2, thirds them at k=3, etc.
 *   3. Independent X/Y axes: zooming X alone does not affect Y and vice versa.
 *   4. Safe fallback: rect.width === 0 or rect.height === 0 returns identity
 *      on that axis (avoid div-by-zero during layout/measurement races).
 *   5. Example anchor: at 1.5× uniform zoom, client (600, 400) with rect
 *      (900, 600) and logical (600, 400) yields (400, ~266.67).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  clampTooltipLeft,
  clampTooltipTop,
  normalizeClientPointer,
} from "./tooltipPositioning";

describe("normalizeClientPointer — properties", () => {
  it("is identity when rect matches logical dimensions (zoom = 1)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        (clientX, clientY, width, height) => {
          const result = normalizeClientPointer(
            clientX,
            clientY,
            { width, height },
            { width, height },
          );
          expect(result.normalizedClientX).toBeCloseTo(clientX, 9);
          expect(result.normalizedClientY).toBeCloseTo(clientY, 9);
        },
      ),
    );
  });

  it("divides client coords by the rect/logical ratio (linear inverse)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 4_000, noNaN: true }),
        fc.double({ min: 1, max: 4_000, noNaN: true }),
        fc.double({ min: 0.5, max: 3, noNaN: true }),
        fc.double({ min: 0.5, max: 3, noNaN: true }),
        (clientX, clientY, logicalW, logicalH, zoomX, zoomY) => {
          const result = normalizeClientPointer(
            clientX,
            clientY,
            { width: logicalW * zoomX, height: logicalH * zoomY },
            { width: logicalW, height: logicalH },
          );
          expect(result.normalizedClientX).toBeCloseTo(clientX / zoomX, 6);
          expect(result.normalizedClientY).toBeCloseTo(clientY / zoomY, 6);
        },
      ),
    );
  });

  it("X and Y axes normalize independently", () => {
    // Zooming only X must leave Y untouched (and vice versa).
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 4_000, noNaN: true }),
        fc.double({ min: 1, max: 4_000, noNaN: true }),
        fc.double({ min: 0.5, max: 3, noNaN: true }),
        (clientX, clientY, logicalW, logicalH, zoomX) => {
          const result = normalizeClientPointer(
            clientX,
            clientY,
            { width: logicalW * zoomX, height: logicalH },
            { width: logicalW, height: logicalH },
          );
          expect(result.normalizedClientX).toBeCloseTo(clientX / zoomX, 6);
          expect(result.normalizedClientY).toBeCloseTo(clientY, 9);
        },
      ),
    );
  });

  it("falls back to identity on X when rect.width is 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        (clientX, clientY, logicalW, logicalH) => {
          const result = normalizeClientPointer(
            clientX,
            clientY,
            { width: 0, height: logicalH },
            { width: logicalW, height: logicalH },
          );
          expect(result.normalizedClientX).toBe(clientX);
          expect(result.normalizedClientY).toBeCloseTo(clientY, 9);
        },
      ),
    );
  });

  it("falls back to identity on Y when rect.height is 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        (clientX, clientY, logicalW, logicalH) => {
          const result = normalizeClientPointer(
            clientX,
            clientY,
            { width: logicalW, height: 0 },
            { width: logicalW, height: logicalH },
          );
          expect(result.normalizedClientX).toBeCloseTo(clientX, 9);
          expect(result.normalizedClientY).toBe(clientY);
        },
      ),
    );
  });
});

describe("normalizeClientPointer — example anchors", () => {
  it("at 1.5× uniform zoom, client (600, 400) normalizes to (400, ~266.67)", () => {
    // Logical canvas 600x400; at 1.5x CSS zoom the rect measures 900x600.
    // A cursor observed at client (600, 400) in zoomed space maps to
    // (600 / 1.5, 400 / 1.5) = (400, 266.666…) in unzoomed viewport pixels.
    const result = normalizeClientPointer(
      600,
      400,
      { width: 900, height: 600 },
      { width: 600, height: 400 },
    );
    expect(result.normalizedClientX).toBeCloseTo(400, 6);
    expect(result.normalizedClientY).toBeCloseTo(400 / 1.5, 6);
  });

  it("at 2× uniform zoom, halves the client coords", () => {
    const result = normalizeClientPointer(
      200,
      100,
      { width: 400, height: 200 },
      { width: 200, height: 100 },
    );
    expect(result.normalizedClientX).toBe(100);
    expect(result.normalizedClientY).toBe(50);
  });

  it("at zoom = 1, passes coords through unchanged", () => {
    const result = normalizeClientPointer(
      123,
      456,
      { width: 800, height: 600 },
      { width: 800, height: 600 },
    );
    expect(result.normalizedClientX).toBe(123);
    expect(result.normalizedClientY).toBe(456);
  });
});

// ---------------------------------------------------------------------------
// clampTooltipLeft / clampTooltipTop — edge-flip + viewport clamp
// ---------------------------------------------------------------------------

describe("clampTooltipLeft — example anchors", () => {
  it("prefers below-right placement (pointer + offset) when the tooltip fits", () => {
    // Pointer well inside a 1000-wide viewport; tooltip width 200 plus
    // offset 12 leaves ~200px of room on the right -> no flip, no clamp.
    expect(clampTooltipLeft(300, 200, 1000, 12)).toBe(312);
  });

  it("flips to the left of the pointer when below-right would overflow", () => {
    // Viewport 1024 (jsdom default). Pointer near right edge with a tooltip
    // wider than the conservative 220 estimate -> must flip left.
    const width = 300;
    const left = clampTooltipLeft(1000, width, 1024, 12);
    // Flipped placement is pointer - offset - width = 1000 - 12 - 300 = 688.
    expect(left).toBe(688);
  });

  it("clamps to `viewportWidth - tooltipWidth` as a safety net if flipped placement would still overflow", () => {
    // Degenerate pointer beyond the right edge. Flipped placement is
    // still past the edge; clamp must bring it back.
    const viewportWidth = 800;
    const tooltipWidth = 300;
    const left = clampTooltipLeft(900, tooltipWidth, viewportWidth, 12);
    // Upper bound = viewportWidth - tooltipWidth = 500; result must be <= 500.
    expect(left).toBeLessThanOrEqual(viewportWidth - tooltipWidth);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it("never returns negative when tooltipWidth exceeds viewportWidth (degenerate)", () => {
    // Tooltip wider than the viewport — impossible to fit without overflow;
    // contract: never go negative (clamp to 0).
    const left = clampTooltipLeft(100, 500, 300, 12);
    expect(left).toBe(0);
  });
});

describe("clampTooltipLeft — properties", () => {
  it("output is always in [0, viewportWidth - tooltipWidth] when tooltip fits", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 5000 }), // pointer — any viewport-space x (can be outside)
        fc.integer({ min: 50, max: 400 }), // tooltip width
        fc.integer({ min: 500, max: 4000 }), // viewport width (always > max tooltip width)
        fc.integer({ min: 0, max: 40 }), // preferred offset
        (pointerX, tooltipWidth, viewportWidth, offset) => {
          fc.pre(viewportWidth > tooltipWidth);
          const left = clampTooltipLeft(pointerX, tooltipWidth, viewportWidth, offset);
          expect(left).toBeGreaterThanOrEqual(0);
          expect(left).toBeLessThanOrEqual(viewportWidth - tooltipWidth);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("never returns negative, even under degenerate inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 0, max: 100 }),
        (pointerX, tooltipWidth, viewportWidth, offset) => {
          const left = clampTooltipLeft(pointerX, tooltipWidth, viewportWidth, offset);
          expect(left).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("clampTooltipTop — example anchors", () => {
  it("prefers below-right placement when the tooltip fits", () => {
    expect(clampTooltipTop(200, 30, 768, 12)).toBe(212);
  });

  it("flips above the pointer when below-preferred would overflow the bottom", () => {
    // Near bottom of 768 viewport with a 40px tooltip -> flip above.
    const height = 40;
    const top = clampTooltipTop(760, height, 768, 12);
    // Flipped = 760 - 12 - 40 = 708.
    expect(top).toBe(708);
  });

  it("clamps result into [0, viewportHeight - tooltipHeight]", () => {
    const top = clampTooltipTop(1500, 30, 768, 12);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(768 - 30);
  });

  it("never returns negative when tooltipHeight exceeds viewportHeight", () => {
    expect(clampTooltipTop(100, 900, 500, 12)).toBe(0);
  });
});

describe("clampTooltipTop — properties", () => {
  it("output is always in [0, viewportHeight - tooltipHeight] when tooltip fits", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 5000 }),
        fc.integer({ min: 20, max: 200 }),
        fc.integer({ min: 400, max: 3000 }),
        fc.integer({ min: 0, max: 40 }),
        (pointerY, tooltipHeight, viewportHeight, offset) => {
          fc.pre(viewportHeight > tooltipHeight);
          const top = clampTooltipTop(pointerY, tooltipHeight, viewportHeight, offset);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(top).toBeLessThanOrEqual(viewportHeight - tooltipHeight);
        },
      ),
      { numRuns: 300 },
    );
  });
});
