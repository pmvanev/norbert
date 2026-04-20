/**
 * Unit tests: niceCeil — axis auto-scale helper.
 *
 * Behaviors under test:
 *   1. Output is always >= input (ceiling semantics).
 *   2. Output is always a "nice" number: `m * 10^k` where
 *      `m in {1, 1.5, 2, 3, 5, 7, 10}`.
 *   3. Monotonic: `a <= b` implies `niceCeil(a) <= niceCeil(b)`.
 *   4. Idempotent on nice inputs: `niceCeil(niceCeil(x)) === niceCeil(x)`.
 *   5. Example-based anchor: hand-picked values map to expected nice numbers.
 *   6. Boundary: non-finite and non-positive inputs return 1.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { niceCeil } from "./scale";

// Check that `candidate` is of the form `m * 10^k` where
// m ∈ {1, 1.5, 2, 3, 5, 7, 10}. We recover k and m and assert m is in the
// allowed set (within a small tolerance for floating-point representation
// of values like 0.1).
const NICE_MANTISSA_SET = new Set([1, 1.5, 2, 3, 5, 7, 10]);

const isNiceNumber = (candidate: number): boolean => {
  if (!Number.isFinite(candidate) || candidate <= 0) return false;
  const exponent = Math.floor(Math.log10(candidate));
  const power = Math.pow(10, exponent);
  const mantissa = candidate / power;
  // Round to nearest allowed mantissa within a tolerance.
  for (const m of NICE_MANTISSA_SET) {
    if (Math.abs(mantissa - m) < 1e-9) return true;
  }
  return false;
};

describe("niceCeil — property-based invariants", () => {
  it("output is always >= input for any finite positive value", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1e9, noNaN: true }), (value) => {
        expect(niceCeil(value)).toBeGreaterThanOrEqual(value);
      }),
    );
  });

  it("output is always a nice number for any finite positive input", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1e9, noNaN: true }), (value) => {
        expect(isNiceNumber(niceCeil(value))).toBe(true);
      }),
    );
  });

  it("is monotonic — a <= b implies niceCeil(a) <= niceCeil(b)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1e9, noNaN: true }),
        fc.double({ min: 0.001, max: 1e9, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(niceCeil(lo)).toBeLessThanOrEqual(niceCeil(hi));
        },
      ),
    );
  });

  it("is idempotent on its own output — niceCeil(niceCeil(x)) === niceCeil(x)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1e9, noNaN: true }), (value) => {
        const once = niceCeil(value);
        const twice = niceCeil(once);
        expect(twice).toBe(once);
      }),
    );
  });
});

describe("niceCeil — example anchors", () => {
  it.each<[number, number]>([
    [0.3, 1],
    [1, 1],
    [1.1, 1.5],
    [1.5, 1.5],
    [1.6, 2],
    [2, 2],
    [2.1, 3],
    [2.5, 3],
    [3, 3],
    [3.1, 5],
    [5, 5],
    [6, 7],
    [7, 7],
    [7.5, 10],
    [10, 10],
    [11, 15],
    [15, 15],
    [16, 20],
    [20, 20],
    [21, 30],
    [30, 30],
    [31, 50],
    [47, 50],
    [50, 50],
    [51, 70],
    [70, 70],
    [71, 100],
    [100, 100],
    [101, 150],
    [123, 150],
    [150, 150],
    [151, 200],
    [200, 200],
    [201, 300],
    [300, 300],
    [301, 500],
    [501, 700],
    [700, 700],
    [701, 1000],
    [1000, 1000],
  ])("niceCeil(%p) === %p", (input, expected) => {
    expect(niceCeil(input)).toBe(expected);
  });
});

describe("niceCeil — boundary behavior", () => {
  it("returns 1 for zero and negative inputs", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-1)).toBe(1);
    expect(niceCeil(-1000)).toBe(1);
  });

  it("returns 1 for non-finite inputs", () => {
    expect(niceCeil(Number.NaN)).toBe(1);
    expect(niceCeil(Number.POSITIVE_INFINITY)).toBe(1);
    expect(niceCeil(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});
