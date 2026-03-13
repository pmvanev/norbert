/**
 * Unit tests: Cost Ticker Data Computation (Step 04-02)
 *
 * Pure function: (sessionCost, sessionAverage) => CostTickerData
 *
 * Properties tested:
 * - Label always formatted as '$X.XX'
 * - Zone is 'dim' when both cost and average are zero
 * - Zone is 'brand' when cost < average or average is zero (no history)
 * - Zone is 'amber' when cost >= average and cost < average * 1.5
 * - Zone is 'red' when cost >= average * 1.5
 *
 * Behaviors: 5 (formatting, dim, brand, amber, red)
 * Test budget: max 10 tests
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeCostTickerData,
  type CostTickerData,
} from "../../../../../src/plugins/norbert-usage/domain/costTicker";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const costArb = fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100);
const positiveCostArb = fc.integer({ min: 1, max: 100_000 }).map((n) => n / 100);

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

describe("Cost ticker label formatting", () => {
  it("always formats as dollar sign with two decimal places", () => {
    fc.assert(
      fc.property(costArb, costArb, (cost, avg) => {
        const ticker = computeCostTickerData(cost, avg);
        expect(ticker.label).toMatch(/^\$\d+\.\d{2}$/);
      }),
    );
  });

  it("formats specific values correctly", () => {
    expect(computeCostTickerData(1.47, 3.0).label).toBe("$1.47");
    expect(computeCostTickerData(0, 0).label).toBe("$0.00");
    expect(computeCostTickerData(100.1, 50).label).toBe("$100.10");
  });
});

// ---------------------------------------------------------------------------
// Zone: dim
// ---------------------------------------------------------------------------

describe("Cost ticker dim zone", () => {
  it("is dim when both cost and average are zero", () => {
    const ticker = computeCostTickerData(0, 0);
    expect(ticker.colorZone).toBe("dim");
  });
});

// ---------------------------------------------------------------------------
// Zone: brand
// ---------------------------------------------------------------------------

describe("Cost ticker brand zone", () => {
  it("is brand when cost < average", () => {
    fc.assert(
      fc.property(
        positiveCostArb,
        (avg) => {
          // cost strictly less than average
          const cost = avg * 0.5;
          const ticker = computeCostTickerData(cost, avg);
          expect(ticker.colorZone).toBe("brand");
        },
      ),
    );
  });

  it("is brand when average is zero but cost is positive (no history)", () => {
    fc.assert(
      fc.property(positiveCostArb, (cost) => {
        const ticker = computeCostTickerData(cost, 0);
        expect(ticker.colorZone).toBe("brand");
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Zone: amber
// ---------------------------------------------------------------------------

describe("Cost ticker amber zone", () => {
  it("is amber when cost >= average and cost < average * 1.5", () => {
    fc.assert(
      fc.property(
        positiveCostArb,
        fc.double({ min: 1.0, max: 1.49, noNaN: true }),
        (avg, multiplier) => {
          const cost = avg * multiplier;
          const ticker = computeCostTickerData(cost, avg);
          expect(ticker.colorZone).toBe("amber");
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Zone: red
// ---------------------------------------------------------------------------

describe("Cost ticker red zone", () => {
  it("is red when cost >= average * 1.5", () => {
    fc.assert(
      fc.property(
        positiveCostArb,
        fc.double({ min: 1.5, max: 10, noNaN: true }),
        (avg, multiplier) => {
          const cost = avg * multiplier;
          const ticker = computeCostTickerData(cost, avg);
          expect(ticker.colorZone).toBe("red");
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Zone completeness: every input maps to exactly one valid zone
// ---------------------------------------------------------------------------

describe("Cost ticker zone completeness", () => {
  it("always returns a valid zone for any non-negative inputs", () => {
    fc.assert(
      fc.property(costArb, costArb, (cost, avg) => {
        const ticker = computeCostTickerData(cost, avg);
        expect(["dim", "brand", "amber", "red"]).toContain(ticker.colorZone);
      }),
    );
  });
});
