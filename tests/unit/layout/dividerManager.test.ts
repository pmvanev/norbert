/**
 * Unit tests: Divider Manager
 *
 * Pure functions for divider position clamping, snapping, and zone width
 * computation. Uses property-based testing for domain invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  clampDividerPosition,
  snapToCenter,
  computeZoneWidths,
} from "../../../src/layout/dividerManager";

const MIN_ZONE_WIDTH_PX = 280;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Container widths that can fit two zones (at least 2 * MIN_ZONE_WIDTH_PX)
const validContainerWidthArb = fc.integer({ min: MIN_ZONE_WIDTH_PX * 2, max: 4000 });

// Arbitrary ratio between 0 and 1
const ratioArb = fc.double({ min: 0, max: 1, noNaN: true });

// ---------------------------------------------------------------------------
// clampDividerPosition
// ---------------------------------------------------------------------------

describe("clampDividerPosition", () => {
  it("clamps ratio so both zones meet minimum width", () => {
    fc.assert(
      fc.property(ratioArb, validContainerWidthArb, (ratio, containerWidth) => {
        const clamped = clampDividerPosition(ratio, containerWidth, MIN_ZONE_WIDTH_PX);

        // Main zone (left) width = clamped * containerWidth >= MIN_ZONE_WIDTH_PX
        const mainWidth = clamped * containerWidth;
        expect(mainWidth).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH_PX - 0.001);

        // Secondary zone (right) width = (1 - clamped) * containerWidth >= MIN_ZONE_WIDTH_PX
        const secondaryWidth = (1 - clamped) * containerWidth;
        expect(secondaryWidth).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH_PX - 0.001);
      }),
      { numRuns: 200 }
    );
  });

  it("returns ratio unchanged when both zones are within bounds", () => {
    const clamped = clampDividerPosition(0.5, 1200, MIN_ZONE_WIDTH_PX);
    expect(clamped).toBe(0.5);
  });

  it("clamps extreme right position", () => {
    const clamped = clampDividerPosition(0.99, 1200, MIN_ZONE_WIDTH_PX);
    // Secondary must be at least 280px, so max ratio = (1200 - 280) / 1200 ~= 0.767
    expect(clamped * 1200).toBeLessThanOrEqual(1200 - MIN_ZONE_WIDTH_PX + 0.001);
  });

  it("clamps extreme left position", () => {
    const clamped = clampDividerPosition(0.01, 1200, MIN_ZONE_WIDTH_PX);
    // Main must be at least 280px, so min ratio = 280 / 1200 ~= 0.233
    expect(clamped * 1200).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH_PX - 0.001);
  });

  // Property: clamped output is always between 0 and 1
  it("output is always a valid ratio between 0 and 1", () => {
    fc.assert(
      fc.property(ratioArb, validContainerWidthArb, (ratio, containerWidth) => {
        const clamped = clampDividerPosition(ratio, containerWidth, MIN_ZONE_WIDTH_PX);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 }
    );
  });

  // Property: idempotent — clamping an already-clamped ratio returns same value
  it("is idempotent", () => {
    fc.assert(
      fc.property(ratioArb, validContainerWidthArb, (ratio, containerWidth) => {
        const once = clampDividerPosition(ratio, containerWidth, MIN_ZONE_WIDTH_PX);
        const twice = clampDividerPosition(once, containerWidth, MIN_ZONE_WIDTH_PX);
        expect(twice).toBeCloseTo(once, 10);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// snapToCenter
// ---------------------------------------------------------------------------

describe("snapToCenter", () => {
  it("always returns 0.5", () => {
    expect(snapToCenter()).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeZoneWidths
// ---------------------------------------------------------------------------

describe("computeZoneWidths", () => {
  it("computes widths that sum to container width", () => {
    fc.assert(
      fc.property(ratioArb, validContainerWidthArb, (ratio, containerWidth) => {
        const clamped = clampDividerPosition(ratio, containerWidth, MIN_ZONE_WIDTH_PX);
        const widths = computeZoneWidths(clamped, containerWidth);
        expect(widths.mainWidth + widths.secondaryWidth).toBeCloseTo(containerWidth, 5);
      }),
      { numRuns: 200 }
    );
  });

  it("computes correct widths at 50/50", () => {
    const widths = computeZoneWidths(0.5, 1000);
    expect(widths.mainWidth).toBe(500);
    expect(widths.secondaryWidth).toBe(500);
  });

  it("computes correct widths at 60/40", () => {
    const widths = computeZoneWidths(0.6, 1000);
    expect(widths.mainWidth).toBeCloseTo(600);
    expect(widths.secondaryWidth).toBeCloseTo(400);
  });
});
