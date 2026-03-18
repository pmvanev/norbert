/**
 * Unit tests: Performance Monitor -- computeCostRatePerMinute (Step 02-03)
 *
 * Pure function: costRatePerSecond => costRatePerMinute
 *
 * Properties tested:
 * - Zero cost rate per second yields zero cost rate per minute
 * - Cost rate per minute equals cost rate per second times 60
 * - Result is always non-negative for non-negative input
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeCostRatePerMinute,
} from "../../../../../src/plugins/norbert-usage/domain/performanceMonitor";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const costRateArb = fc.double({ min: 0, max: 100, noNaN: true });

// ---------------------------------------------------------------------------
// Properties: computeCostRatePerMinute
// ---------------------------------------------------------------------------

describe("computeCostRatePerMinute properties", () => {
  it("@property: zero cost rate per second yields zero per minute", () => {
    expect(computeCostRatePerMinute(0)).toBe(0);
  });

  it("@property: cost rate per minute equals rate per second times 60", () => {
    fc.assert(
      fc.property(costRateArb, (ratePerSecond) => {
        const result = computeCostRatePerMinute(ratePerSecond);
        expect(result).toBeCloseTo(ratePerSecond * 60, 10);
      }),
      { numRuns: 200 },
    );
  });

  it("@property: result is always non-negative for non-negative input", () => {
    fc.assert(
      fc.property(costRateArb, (ratePerSecond) => {
        const result = computeCostRatePerMinute(ratePerSecond);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});
