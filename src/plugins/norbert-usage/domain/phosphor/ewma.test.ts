/**
 * Unit tests: ewmaStep — single exponentially weighted moving-average step.
 *
 * Semantics: `ewmaStep(current, target, alpha) = current*(1-alpha) + target*alpha`.
 * Behaviors:
 *   1. Convergence — repeated steps toward a fixed target reduce the gap.
 *   2. Idempotence at target — when current === target, result === target.
 *   3. Bounds — result is bounded by the closed interval [min(current,target), max(current,target)]
 *      whenever alpha ∈ [0, 1].
 *
 * No effects; pure function under test.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { ewmaStep } from "./ewma";

describe("ewmaStep — idempotence at target", () => {
  it("returns target unchanged when current already equals target", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (value, alpha) => {
          expect(ewmaStep(value, value, alpha)).toBe(value);
        },
      ),
    );
  });
});

describe("ewmaStep — convergence", () => {
  it("moves current toward target when alpha is in (0, 1)", () => {
    const stepped = ewmaStep(0, 10, 0.5);
    expect(stepped).toBe(5);
  });

  it("reduces the gap to target on each step", () => {
    let current = 0;
    const target = 10;
    const alpha = 0.25;
    let prevGap = Math.abs(target - current);
    for (let i = 0; i < 20; i++) {
      current = ewmaStep(current, target, alpha);
      const gap = Math.abs(target - current);
      expect(gap).toBeLessThan(prevGap);
      prevGap = gap;
    }
  });
});

describe("ewmaStep — bounded result", () => {
  it("result lies within [min(current,target), max(current,target)] for alpha in [0,1]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (current, target, alpha) => {
          const result = ewmaStep(current, target, alpha);
          const lo = Math.min(current, target);
          const hi = Math.max(current, target);
          expect(result).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(result).toBeLessThanOrEqual(hi + 1e-9);
        },
      ),
    );
  });

  it("returns current when alpha is 0 (no attraction)", () => {
    expect(ewmaStep(7, 42, 0)).toBe(7);
  });

  it("returns target when alpha is 1 (full attraction)", () => {
    expect(ewmaStep(7, 42, 1)).toBe(42);
  });
});
