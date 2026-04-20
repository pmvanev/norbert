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

import { normalizeClientPointer } from "./tooltipPositioning";

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
